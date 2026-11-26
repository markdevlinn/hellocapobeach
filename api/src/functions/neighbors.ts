import { app } from "@azure/functions";
import { endpoint, fail, json, readBody } from "../lib/http";
import { sql } from "../lib/db";
import { parseProfile } from "../lib/rules";

// GET /api/neighbors
// The directory. Only neighbors who chose to be listed, and only the contact
// details each one switched on. The database view does the hiding.
app.http("neighbors", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "neighbors",
  handler: endpoint("approved", async ({ pool }) => {
    const r = await pool.request().query(
      `select id, full_name as name, street, house_number as houseNumber, phone, email
       from dbo.neighbors where in_directory = 1 order by street, full_name`
    );
    return json(200, { neighbors: r.recordset });
  }),
});

// GET  /api/profile   my own details and privacy switches
// POST /api/profile   change my phone number and privacy switches
app.http("profile", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "profile",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const me = member!;
    if (req.method === "POST") {
      const parsed = parseProfile(await readBody(req));
      if (!parsed.ok) return fail(400, parsed.message);
      const v = parsed.value;
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, me.id)
        .input("phone", sql.NVarChar(30), v.phone)
        .input("showPhone", sql.Bit, v.showPhone)
        .input("showEmail", sql.Bit, v.showEmail)
        .input("showHouse", sql.Bit, v.showHouseNumber)
        .input("inDirectory", sql.Bit, v.inDirectory)
        .query(
          `update dbo.members set phone = @phone, show_phone = @showPhone, show_email = @showEmail,
                  show_house_number = @showHouse, in_directory = @inDirectory
           where id = @id`
        );
    }
    const r = await pool
      .request()
      .input("id", sql.UniqueIdentifier, me.id)
      .query(
        `select m.full_name as name, m.email, m.phone, m.house_number as houseNumber, coalesce(s.name, m.street_other) as street,
                m.show_phone as showPhone, m.show_email as showEmail, m.show_house_number as showHouseNumber, m.in_directory as inDirectory
         from dbo.members m left join dbo.streets s on s.id = m.street_id where m.id = @id`
      );
    return json(200, { profile: r.recordset[0] });
  }),
});
