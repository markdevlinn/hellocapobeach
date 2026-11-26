import { app } from "@azure/functions";
import { randomInt } from "node:crypto";
import { endpoint, fail, json } from "../lib/http";
import { sql } from "../lib/db";
import { displayCode, invitesLeft, newCode } from "../lib/rules";

// GET  /api/invites  : the codes I have created and whether each was used
// POST /api/invites  : create one more code (5 per member, no limit for admins)
app.http("invites", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "invites",
  handler: endpoint("approved", async ({ req, member, pool }) => {
    const me = member!;
    if (req.method === "POST") {
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        const count = await new sql.Request(tx)
          .input("id", sql.UniqueIdentifier, me.id)
          .query<{ n: number }>("select count(*) as n from dbo.invite_codes with (updlock, holdlock) where created_by = @id");
        if (invitesLeft(me, count.recordset[0].n) === 0) {
          await tx.rollback();
          return fail(400, "You have used all of your invite codes.");
        }
        const code = newCode((max) => randomInt(max));
        await new sql.Request(tx)
          .input("code", sql.NVarChar(40), code)
          .input("id", sql.UniqueIdentifier, me.id)
          .query("insert into dbo.invite_codes (code, created_by, note) values (@code, @id, N'Member invite')");
        await tx.commit();
      } catch (err) {
        await tx.rollback().catch(() => undefined);
        throw err;
      }
    }

    const list = await pool
      .request()
      .input("id", sql.UniqueIdentifier, me.id)
      .query<{ code: string; invitee_name: string | null; used_at: Date | null; is_active: boolean }>(
        `select code, invitee_name, used_at, is_active from dbo.member_invites
         where inviter_id = @id order by created_at desc`
      );
    return json(200, {
      invitesLeft: invitesLeft(me, list.recordset.length),
      codes: list.recordset.map((c) => ({
        code: displayCode(c.code),
        used: c.used_at !== null,
        usedBy: c.invitee_name,
        active: c.is_active,
      })),
    });
  }),
});
