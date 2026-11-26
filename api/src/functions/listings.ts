import { app } from "@azure/functions";
import { endpoint, fail, json, readBody } from "../lib/http";
import { sql } from "../lib/db";
import { canRemove, isListingKind, isUuid, parseListing } from "../lib/rules";

// GET  /api/listings?kind=   the marketplace, newest first
// POST /api/listings         list an item
app.http("listings", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "listings",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    if (req.method === "POST") {
      const parsed = parseListing(await readBody(req));
      if (!parsed.ok) return fail(400, parsed.message);
      const v = parsed.value;
      const r = await pool
        .request()
        .input("seller", sql.UniqueIdentifier, member!.id)
        .input("kind", sql.VarChar(10), v.kind)
        .input("title", sql.NVarChar(140), v.title)
        .input("details", sql.NVarChar(sql.MAX), v.details)
        .input("price", sql.Int, v.priceCents)
        .input("phone", sql.NVarChar(30), v.contactPhone)
        .input("email", sql.NVarChar(254), v.contactEmail)
        .query<{ id: string }>(
          `insert into dbo.listings (seller_id, kind, title, details, price_cents, contact_phone, contact_email)
           output inserted.id values (@seller, @kind, @title, @details, @price, @phone, @email)`
        );
      return json(201, { id: r.recordset[0].id });
    }

    const kind = req.query.get("kind");
    const request = pool.request();
    let filter = "";
    if (isListingKind(kind)) {
      request.input("kind", sql.VarChar(10), kind);
      filter = "and l.kind = @kind";
    }
    const r = await request.query(
      `select top 100 l.id, l.kind, l.title, l.details, l.price_cents as priceCents, l.is_sold as sold,
              l.contact_phone as contactPhone, l.contact_email as contactEmail, l.created_at as createdAt,
              l.seller_id as sellerId, m.full_name as seller, coalesce(s.name, m.street_other) as street
       from dbo.listings l
       join dbo.members m on m.id = l.seller_id
       left join dbo.streets s on s.id = m.street_id
       where l.removed_at is null ${filter}
       order by l.is_sold, l.created_at desc`
    );
    return json(200, { listings: r.recordset });
  }),
});

// POST /api/listings/{id}/sold | unsold | remove
app.http("listingAction", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "listings/{id}/{action}",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const me = member!;
    const id = req.params.id;
    const action = req.params.action;
    if (!isUuid(id)) return fail(404, "That listing was not found.");
    const found = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query<{ seller_id: string }>("select seller_id from dbo.listings where id = @id and removed_at is null");
    if (found.recordset.length === 0) return fail(404, "That listing was not found.");
    const mine = found.recordset[0].seller_id.toLowerCase() === me.id.toLowerCase();

    if (action === "sold" || action === "unsold") {
      if (!mine) return fail(403, "Only the person who listed it can mark it sold.");
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("sold", sql.Bit, action === "sold")
        .query("update dbo.listings set is_sold = @sold where id = @id");
      return json(200, { ok: true });
    }
    if (action === "remove") {
      if (!canRemove(me, found.recordset[0].seller_id)) return fail(403, "You can only remove your own listings.");
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("by", sql.UniqueIdentifier, me.id)
        .query("update dbo.listings set removed_at = sysutcdatetime(), removed_by = @by where id = @id");
      return json(200, { ok: true });
    }
    return fail(400, "Unknown action.");
  }),
});
