import { app } from "@azure/functions";
import { endpoint, fail, json } from "../lib/http";
import { sql } from "../lib/db";

// GET /api/admin/pending
// Neighbors waiting in the holding area. Admins only.
app.http("adminPending", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/pending",
  handler: endpoint("admin", async ({ pool }) => {
    const r = await pool.request().query(
      `select m.id, m.full_name as name, m.email, m.phone, m.house_number as houseNumber,
              coalesce(s.name, m.street_other) as street, m.created_at as askedAt
       from dbo.members m
       left join dbo.streets s on s.id = m.street_id
       where m.status = 'pending'
       order by m.created_at`
    );
    return json(200, { pending: r.recordset });
  }),
});

// POST /api/admin/members/{id}/approve  or  /decline
app.http("adminDecide", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "admin/members/{id}/{decision}",
  handler: endpoint("admin", async ({ req, member, pool }) => {
    const id = req.params.id ?? "";
    const decision = req.params.decision;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return fail(400, "That member was not found.");
    if (decision !== "approve" && decision !== "decline") return fail(400, "Unknown action.");
    const status = decision === "approve" ? "approved" : "declined";
    const r = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("status", sql.VarChar(10), status)
      .input("by", sql.UniqueIdentifier, member!.id)
      .query(
        `update dbo.members
         set status = @status,
             approved_at = case when @status = 'approved' then sysutcdatetime() end,
             approved_by = case when @status = 'approved' then @by end
         where id = @id and status = 'pending'`
      );
    if (r.rowsAffected[0] === 0) return fail(404, "That request is no longer waiting.");
    return json(200, { state: status });
  }),
});
