import { app } from "@azure/functions";
import { endpoint, fail, json, readBody } from "../lib/http";
import { sql } from "../lib/db";
import { canRemove, isUuid, parseEvent } from "../lib/rules";

// GET  /api/events   upcoming events, soonest first
// POST /api/events   add an event
app.http("events", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "events",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const me = member!;
    if (req.method === "POST") {
      const parsed = parseEvent(await readBody(req), new Date());
      if (!parsed.ok) return fail(400, parsed.message);
      const v = parsed.value;
      const r = await pool
        .request()
        .input("by", sql.UniqueIdentifier, me.id)
        .input("title", sql.NVarChar(140), v.title)
        .input("details", sql.NVarChar(sql.MAX), v.details)
        .input("place", sql.NVarChar(200), v.place)
        .input("starts", sql.DateTimeOffset, v.startsAt)
        .query<{ id: string }>(
          "insert into dbo.events (created_by, title, details, place, starts_at) output inserted.id values (@by, @title, @details, @place, @starts)"
        );
      // The person who posts it is going.
      await pool
        .request()
        .input("event", sql.UniqueIdentifier, r.recordset[0].id)
        .input("me", sql.UniqueIdentifier, me.id)
        .query("insert into dbo.event_rsvps (event_id, member_id) values (@event, @me)");
      return json(201, { id: r.recordset[0].id });
    }

    const r = await pool
      .request()
      .input("me", sql.UniqueIdentifier, me.id)
      .query(
        `select top 60 e.id, e.title, e.details, e.place, e.starts_at as startsAt, e.created_by as createdBy,
                m.full_name as host,
                (select count(*) from dbo.event_rsvps r where r.event_id = e.id) as going,
                cast(case when exists (select 1 from dbo.event_rsvps r where r.event_id = e.id and r.member_id = @me) then 1 else 0 end as bit) as iAmGoing
         from dbo.events e
         join dbo.members m on m.id = e.created_by
         where e.removed_at is null and e.starts_at >= dateadd(hour, -3, sysdatetimeoffset())
         order by e.starts_at`
      );
    return json(200, { events: r.recordset });
  }),
});

// POST /api/events/{id}/going | notgoing | remove
app.http("eventAction", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "events/{id}/{action}",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const me = member!;
    const id = req.params.id;
    const action = req.params.action;
    if (!isUuid(id)) return fail(404, "That event was not found.");
    const found = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query<{ created_by: string }>("select created_by from dbo.events where id = @id and removed_at is null");
    if (found.recordset.length === 0) return fail(404, "That event was not found.");

    if (action === "going") {
      await pool
        .request()
        .input("event", sql.UniqueIdentifier, id)
        .input("me", sql.UniqueIdentifier, me.id)
        .query(
          `if not exists (select 1 from dbo.event_rsvps where event_id = @event and member_id = @me)
             insert into dbo.event_rsvps (event_id, member_id) values (@event, @me)`
        );
      return json(200, { ok: true });
    }
    if (action === "notgoing") {
      await pool
        .request()
        .input("event", sql.UniqueIdentifier, id)
        .input("me", sql.UniqueIdentifier, me.id)
        .query("delete from dbo.event_rsvps where event_id = @event and member_id = @me");
      return json(200, { ok: true });
    }
    if (action === "remove") {
      if (!canRemove(me, found.recordset[0].created_by)) return fail(403, "You can only remove your own events.");
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("by", sql.UniqueIdentifier, me.id)
        .query("update dbo.events set removed_at = sysutcdatetime(), removed_by = @by where id = @id");
      return json(200, { ok: true });
    }
    return fail(400, "Unknown action.");
  }),
});
