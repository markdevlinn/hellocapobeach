import { app } from "@azure/functions";
import { endpoint, fail, json, readBody } from "../lib/http";
import { sql } from "../lib/db";
import { parseSignup, statusAfterSignup } from "../lib/rules";

// POST /api/signup
// Creates the membership for the signed-in person.
// With a valid invite code they are in right away. Without one they wait for approval.
app.http("signup", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "signup",
  handler: endpoint("signed-in", async ({ req, identity, member, pool }) => {
    if (member) return fail(409, "You have already asked to join.");
    if (!identity!.email) return fail(400, "We could not read your email address from sign-in. Please sign out and try again.");

    const parsed = parseSignup(await readBody(req));
    if (!parsed.ok) return fail(400, parsed.message);
    const input = parsed.value;

    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const street = await new sql.Request(tx)
        .input("street", sql.Int, input.streetId)
        .query("select street_id from dbo.signup_street_options where street_id = @street");
      if (street.recordset.length === 0) {
        await tx.rollback();
        return fail(400, "That street is not open for sign-up yet.");
      }

      const taken = await new sql.Request(tx)
        .input("email", sql.NVarChar(254), identity!.email)
        .query("select 1 as x from dbo.members where email = @email");
      if (taken.recordset.length > 0) {
        await tx.rollback();
        return fail(409, "That email address already has an account.");
      }

      // Claim the invite code in one step so it cannot be used twice.
      let inviter: string | null = null;
      let hasInvite = false;
      if (input.inviteCode) {
        const claim = await new sql.Request(tx)
          .input("code", sql.NVarChar(40), input.inviteCode)
          .query<{ created_by: string | null }>(
            `update dbo.invite_codes set used_at = sysutcdatetime()
             output inserted.created_by
             where code = @code and is_active = 1 and used_at is null and used_by is null`
          );
        if (claim.recordset.length === 0) {
          await tx.rollback();
          return fail(400, "That invite code is not valid or has already been used.");
        }
        hasInvite = true;
        inviter = claim.recordset[0].created_by;
      }

      const status = statusAfterSignup(hasInvite);
      const created = await new sql.Request(tx)
        .input("subject", sql.NVarChar(128), identity!.subject)
        .input("email", sql.NVarChar(254), identity!.email)
        .input("name", sql.NVarChar(80), input.fullName)
        .input("street", sql.Int, input.streetId)
        .input("house", sql.NVarChar(12), input.houseNumber)
        .input("phone", sql.NVarChar(30), input.phone)
        .input("code", sql.NVarChar(40), input.inviteCode)
        .input("status", sql.VarChar(10), status)
        .input("inviter", sql.UniqueIdentifier, inviter)
        .query<{ id: string }>(
          `insert into dbo.members
             (auth_subject, email, full_name, street_id, house_number, phone, invite_code, status, role, approved_at, approved_by)
           output inserted.id
           values
             (@subject, @email, @name, @street, @house, @phone, @code, @status, 'resident',
              case when @status = 'approved' then sysutcdatetime() end,
              case when @status = 'approved' then @inviter end)`
        );

      if (hasInvite) {
        await new sql.Request(tx)
          .input("code", sql.NVarChar(40), input.inviteCode)
          .input("id", sql.UniqueIdentifier, created.recordset[0].id)
          .query("update dbo.invite_codes set used_by = @id where code = @code");
      }

      await tx.commit();
      return json(201, { state: status });
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }),
});
