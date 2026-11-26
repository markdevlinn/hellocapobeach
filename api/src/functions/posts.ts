import { app } from "@azure/functions";
import { endpoint, fail, json, readBody } from "../lib/http";
import { sql } from "../lib/db";
import { canRemove, isCategory, isUuid, parseComment, parsePost } from "../lib/rules";

const AUTHOR = `m.full_name as author, coalesce(s.name, m.street_other) as street`;
const AUTHOR_JOIN = `join dbo.members m on m.id = x.author_id left join dbo.streets s on s.id = m.street_id`;

// GET  /api/posts?category=   the feed: pinned first, then newest
// POST /api/posts             write a post
app.http("posts", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "posts",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    if (req.method === "POST") {
      const parsed = parsePost(await readBody(req));
      if (!parsed.ok) return fail(400, parsed.message);
      const r = await pool
        .request()
        .input("author", sql.UniqueIdentifier, member!.id)
        .input("category", sql.VarChar(20), parsed.value.category)
        .input("title", sql.NVarChar(140), parsed.value.title)
        .input("body", sql.NVarChar(sql.MAX), parsed.value.body)
        .query<{ id: string }>(
          "insert into dbo.posts (author_id, category, title, body) output inserted.id values (@author, @category, @title, @body)"
        );
      return json(201, { id: r.recordset[0].id });
    }

    const category = req.query.get("category");
    const request = pool.request();
    let filter = "";
    if (isCategory(category)) {
      request.input("category", sql.VarChar(20), category);
      filter = "and x.category = @category";
    }
    const r = await request.query(
      `select top 60 x.id, x.category, x.title, x.body, x.is_pinned as pinned, x.created_at as createdAt, x.author_id as authorId, ${AUTHOR},
              (select count(*) from dbo.comments c where c.post_id = x.id and c.removed_at is null) as comments
       from dbo.posts x ${AUTHOR_JOIN}
       where x.removed_at is null ${filter}
       order by x.is_pinned desc, x.created_at desc`
    );
    return json(200, { posts: r.recordset });
  }),
});

// GET /api/posts/{id}   one post with its comments
app.http("post", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "posts/{id}",
  handler: endpoint("approved", async ({ req, pool }) => {
    const id = req.params.id;
    if (!isUuid(id)) return fail(404, "That post was not found.");
    const p = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(
        `select x.id, x.category, x.title, x.body, x.is_pinned as pinned, x.created_at as createdAt, x.author_id as authorId, ${AUTHOR}
         from dbo.posts x ${AUTHOR_JOIN}
         where x.id = @id and x.removed_at is null`
      );
    if (p.recordset.length === 0) return fail(404, "That post was not found.");
    const c = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(
        `select x.id, x.parent_id as parentId, x.body, x.created_at as createdAt, x.author_id as authorId, ${AUTHOR}
         from dbo.comments x ${AUTHOR_JOIN}
         where x.post_id = @id and x.removed_at is null
         order by x.created_at`
      );
    return json(200, { post: p.recordset[0], comments: c.recordset });
  }),
});

// POST /api/posts/{id}/comments | pin | unpin | remove
app.http("postAction", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "posts/{id}/{action}",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const me = member!;
    const id = req.params.id;
    const action = req.params.action;
    if (!isUuid(id)) return fail(404, "That post was not found.");

    const found = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query<{ author_id: string }>("select author_id from dbo.posts where id = @id and removed_at is null");
    if (found.recordset.length === 0) return fail(404, "That post was not found.");
    const post = found.recordset[0];

    if (action === "comments") {
      const parsed = parseComment(await readBody(req));
      if (!parsed.ok) return fail(400, parsed.message);
      // One level of replies: a reply to a reply joins the same thread.
      let parentId: string | null = null;
      if (parsed.value.parentId) {
        const parent = await pool
          .request()
          .input("pid", sql.UniqueIdentifier, parsed.value.parentId)
          .input("post", sql.UniqueIdentifier, id)
          .query<{ id: string; parent_id: string | null }>(
            "select id, parent_id from dbo.comments where id = @pid and post_id = @post and removed_at is null"
          );
        if (parent.recordset.length === 0) return fail(400, "That comment was not found.");
        parentId = parent.recordset[0].parent_id ?? parent.recordset[0].id;
      }
      await pool
        .request()
        .input("post", sql.UniqueIdentifier, id)
        .input("author", sql.UniqueIdentifier, me.id)
        .input("parent", sql.UniqueIdentifier, parentId)
        .input("body", sql.NVarChar(2000), parsed.value.body)
        .query("insert into dbo.comments (post_id, author_id, parent_id, body) values (@post, @author, @parent, @body)");
      return json(201, { ok: true });
    }

    if (action === "pin" || action === "unpin") {
      if (me.role !== "admin") return fail(403, "Only admins can pin posts.");
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("pinned", sql.Bit, action === "pin")
        .query("update dbo.posts set is_pinned = @pinned where id = @id");
      return json(200, { ok: true });
    }

    if (action === "remove") {
      if (!canRemove(me, post.author_id)) return fail(403, "You can only remove your own posts.");
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("by", sql.UniqueIdentifier, me.id)
        .query("update dbo.posts set removed_at = sysutcdatetime(), removed_by = @by, is_pinned = 0 where id = @id");
      return json(200, { ok: true });
    }

    return fail(400, "Unknown action.");
  }),
});

// POST /api/comments/{id}/remove
app.http("commentRemove", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "comments/{id}/remove",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const id = req.params.id;
    if (!isUuid(id)) return fail(404, "That comment was not found.");
    const found = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query<{ author_id: string }>("select author_id from dbo.comments where id = @id and removed_at is null");
    if (found.recordset.length === 0) return fail(404, "That comment was not found.");
    if (!canRemove(member!, found.recordset[0].author_id)) return fail(403, "You can only remove your own comments.");
    // Removing a comment also hides the replies under it.
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("by", sql.UniqueIdentifier, member!.id)
      .query("update dbo.comments set removed_at = sysutcdatetime(), removed_by = @by where (id = @id or parent_id = @id) and removed_at is null");
    return json(200, { ok: true });
  }),
});
