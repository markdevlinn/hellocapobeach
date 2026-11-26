import { app } from "@azure/functions";
import { endpoint, json } from "../lib/http";
import { sql } from "../lib/db";
import { invitesLeft } from "../lib/rules";

// GET /api/me
// Tells the app where this person stands: not joined yet, waiting, or in.
app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "me",
  handler: endpoint("signed-in", async ({ identity, member, pool }) => {
    if (!member) return json(200, { state: "none", email: identity!.email });
    let invites: number | "unlimited" = 0;
    if (member.status === "approved") {
      const c = await pool
        .request()
        .input("id", sql.UniqueIdentifier, member.id)
        .query<{ n: number }>("select count(*) as n from dbo.invite_codes where created_by = @id");
      invites = invitesLeft(member, c.recordset[0].n);
    }
    return json(200, {
      state: member.status,
      id: member.id,
      name: member.full_name,
      email: member.email,
      isAdmin: member.status === "approved" && member.role === "admin",
      invitesLeft: invites,
    });
  }),
});
