import { app } from "@azure/functions";
import { endpoint, fail, json, readBody } from "../lib/http";
import { sql } from "../lib/db";
import { adminMayChange, displayCode, isMemberDecision, isUuid, memberTransition, MemberStatus, normalizeCode, parseMemberEdit } from "../lib/rules";

// Everything in this file is for admins only.
// The routes start with "manage" because Azure Functions reserves the "admin" prefix.

const MEMBER_COLUMNS = `m.id, m.full_name as name, m.email, m.phone, m.house_number as houseNumber, m.street_id as streetId,
        coalesce(s.name, m.street_other) as street, m.status, m.role, m.in_directory as inDirectory,
        m.created_at as joinedAt, m.approved_at as approvedAt`;

// GET /api/manage/pending   neighbors waiting in the holding area
app.http("managePending", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "manage/pending",
  handler: endpoint("admin", async ({ pool }) => {
    const r = await pool.request().query(
      `select ${MEMBER_COLUMNS}, m.created_at as askedAt
       from dbo.members m left join dbo.streets s on s.id = m.street_id
       where m.status = 'pending' order by m.created_at`
    );
    return json(200, { pending: r.recordset });
  }),
});

// GET /api/manage/members   every member, whatever their status
app.http("manageMembers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "manage/members",
  handler: endpoint("admin", async ({ pool }) => {
    const r = await pool.request().query(
      `select ${MEMBER_COLUMNS},
              (select top 1 i.full_name from dbo.invite_codes c join dbo.members i on i.id = c.created_by where c.used_by = m.id) as invitedBy
       from dbo.members m left join dbo.streets s on s.id = m.street_id
       order by case m.status when 'pending' then 0 when 'approved' then 1 else 2 end, m.full_name`
    );
    return json(200, { members: r.recordset });
  }),
});

// POST /api/manage/members/{id}/approve | decline | remove | restore | edit
app.http("manageMember", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "manage/members/{id}/{decision}",
  handler: endpoint("admin", async ({ req, member, pool }) => {
    const me = member!;
    const id = req.params.id;
    const decision = req.params.decision;
    if (!isUuid(id)) return fail(404, "That member was not found.");

    const found = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query<{ status: MemberStatus }>("select status from dbo.members where id = @id");
    if (found.recordset.length === 0) return fail(404, "That member was not found.");

    if (decision === "edit") {
      const parsed = parseMemberEdit(await readBody(req));
      if (!parsed.ok) return fail(400, parsed.message);
      const street = await pool
        .request()
        .input("street", sql.Int, parsed.value.streetId)
        .query("select street_id from dbo.signup_street_options where street_id = @street");
      if (street.recordset.length === 0) return fail(400, "That street is not open yet.");
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("name", sql.NVarChar(80), parsed.value.fullName)
        .input("street", sql.Int, parsed.value.streetId)
        .input("house", sql.NVarChar(12), parsed.value.houseNumber)
        .query("update dbo.members set full_name = @name, street_id = @street, street_other = null, house_number = @house where id = @id");
      return json(200, { ok: true });
    }

    if (!isMemberDecision(decision)) return fail(400, "Unknown action.");
    if (!adminMayChange(me.id, id, decision)) return fail(400, "You cannot remove yourself. Another admin would have to do that.");
    const next = memberTransition(found.recordset[0].status, decision);
    if (!next) return fail(409, "That member's status has already changed. Refresh and try again.");

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("status", sql.VarChar(10), next)
      .input("by", sql.UniqueIdentifier, me.id)
      .query(
        `update dbo.members
         set status = @status,
             approved_at = case when @status = 'approved' then sysutcdatetime() else approved_at end,
             approved_by = case when @status = 'approved' then @by else approved_by end,
             in_directory = case when @status = 'approved' then in_directory else 0 end
         where id = @id`
      );
    // A removed member's unused invite codes stop working.
    if (next === "removed") {
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query("update dbo.invite_codes set is_active = 0 where created_by = @id and used_at is null");
    }
    return json(200, { state: next });
  }),
});

// GET /api/manage/content   recent posts, comments, events and listings in one call
app.http("manageContent", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "manage/content",
  handler: endpoint("admin", async ({ pool }) => {
    const posts = await pool.request().query(
      `select top 100 p.id, p.title, p.category, p.is_pinned as pinned, p.created_at as createdAt, m.full_name as author
       from dbo.posts p join dbo.members m on m.id = p.author_id
       where p.removed_at is null order by p.created_at desc`
    );
    const comments = await pool.request().query(
      `select top 100 c.id, c.body, c.created_at as createdAt, m.full_name as author, p.id as postId, p.title as postTitle
       from dbo.comments c join dbo.members m on m.id = c.author_id join dbo.posts p on p.id = c.post_id
       where c.removed_at is null and p.removed_at is null order by c.created_at desc`
    );
    const events = await pool.request().query(
      `select top 100 e.id, e.title, e.place, e.starts_at as startsAt, m.full_name as author
       from dbo.events e join dbo.members m on m.id = e.created_by
       where e.removed_at is null order by e.starts_at desc`
    );
    const listings = await pool.request().query(
      `select top 100 l.id, l.title, l.kind, l.is_sold as sold, l.created_at as createdAt, m.full_name as author
       from dbo.listings l join dbo.members m on m.id = l.seller_id
       where l.removed_at is null order by l.created_at desc`
    );
    return json(200, { posts: posts.recordset, comments: comments.recordset, events: events.recordset, listings: listings.recordset });
  }),
});

// GET /api/manage/invites   every invite code and who used it
app.http("manageInvites", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "manage/invites",
  handler: endpoint("admin", async ({ pool }) => {
    const r = await pool.request().query<{
      code: string;
      inviter_name: string | null;
      invitee_name: string | null;
      used_at: Date | null;
      is_active: boolean;
      created_at: Date;
    }>("select top 300 code, inviter_name, invitee_name, used_at, is_active, created_at from dbo.member_invites order by created_at desc");
    return json(200, {
      invites: r.recordset.map((c) => ({
        code: displayCode(c.code),
        createdBy: c.inviter_name,
        usedBy: c.invitee_name,
        used: c.used_at !== null,
        active: c.is_active,
        createdAt: c.created_at,
      })),
    });
  }),
});

// POST /api/manage/invites/{code}/off   switch off a code that has not been used
app.http("manageInviteOff", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "manage/invites/{code}/off",
  handler: endpoint("admin", async ({ req, pool }) => {
    const code = normalizeCode(req.params.code);
    if (!code) return fail(404, "That code was not found.");
    const r = await pool
      .request()
      .input("code", sql.NVarChar(40), code)
      .query("update dbo.invite_codes set is_active = 0 where code = @code and used_at is null");
    if (r.rowsAffected[0] === 0) return fail(409, "That code was already used or does not exist.");
    return json(200, { ok: true });
  }),
});
