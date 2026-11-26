import { app } from "@azure/functions";
import { endpoint, json } from "../lib/http";

// GET /api/streets
// The sign-up pick list. Street names are public information.
app.http("streets", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "streets",
  handler: endpoint("public", async ({ pool }) => {
    const r = await pool
      .request()
      .query("select street_id as id, street as name, neighborhood from dbo.signup_street_options order by sort_order, street");
    return json(200, { streets: r.recordset });
  }),
});
