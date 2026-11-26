import { app } from "@azure/functions";
import { endpoint, json } from "../lib/http";
import { sql } from "../lib/db";
import { invitesLeft, sessionNeedsRenewal } from "../lib/rules";
import { renewSession, sessionCookie } from "../lib/session";

// GET /api/me
// Tells the app where this person stands: not joined yet, waiting, or in.
app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "me",
  handler: endpoint("signed-in", async ({ identity, member, pool, via, sessionToken, session }) => {
    // A device that is still in use keeps its 90 days topped up.
    const renew = via === "session" && sessionToken && session && sessionNeedsRenewal(session.expiresAt, new Date());
    if (renew) await renewSession(pool, sessionToken!);
    const cookies = renew ? [sessionCookie(sessionToken!)] : undefined;
    if (!member) return { ...json(200, { state: "none", email: identity!.email, via }), cookies };
    let invites: number | "unlimited" = 0;
    if (member.status === "approved") {
      const c = await pool
        .request()
        .input("id", sql.UniqueIdentifier, member.id)
        .query<{ n: number }>("select count(*) as n from dbo.invite_codes where created_by = @id");
      invites = invitesLeft(member, c.recordset[0].n);
    }
    return {
      ...json(200, {
      state: member.status,
      via,
      id: member.id,
      name: member.full_name,
      email: member.email,
      isAdmin: member.status === "approved" && member.role === "admin",
      invitesLeft: invites,
      inDirectory: member.in_directory === true,
      }),
      cookies,
    };
  }),
});
