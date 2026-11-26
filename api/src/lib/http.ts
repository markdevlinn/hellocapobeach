import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { identify, Identity } from "./auth";
import { getPool, isWakingUp, resetPool, sql } from "./db";
import { Access, allowed, MemberRole, MemberStatus } from "./rules";

export interface Member {
  id: string;
  email: string;
  full_name: string;
  status: MemberStatus;
  role: MemberRole;
}

export interface Ctx {
  req: HttpRequest;
  log: InvocationContext;
  identity: Identity | null;
  member: Member | null;
  pool: sql.ConnectionPool;
}

export function json(status: number, body: unknown): HttpResponseInit {
  return { status, headers: { "Cache-Control": "no-store" }, jsonBody: body };
}

export function fail(status: number, message: string): HttpResponseInit {
  return json(status, { error: message });
}

export async function findMember(pool: sql.ConnectionPool, subject: string): Promise<Member | null> {
  const r = await pool
    .request()
    .input("subject", sql.NVarChar(128), subject)
    .query<Member>("select id, email, full_name, status, role from dbo.members where auth_subject = @subject");
  return r.recordset[0] ?? null;
}

/**
 * Every endpoint is wrapped in this. It works out who is calling, loads their
 * membership, and refuses the request unless they meet the level the endpoint needs.
 */
export function endpoint(need: Access, handler: (ctx: Ctx) => Promise<HttpResponseInit>) {
  return async (req: HttpRequest, log: InvocationContext): Promise<HttpResponseInit> => {
    try {
      let identity: Identity | null = null;
      if (need !== "public") {
        identity = await identify(req.headers.get("x-hcb-token"), req.headers.get("x-hcb-idtoken"));
        if (!identity) return fail(401, "Please sign in.");
      }
      const pool = await getPool();
      const member = identity ? await findMember(pool, identity.subject) : null;
      if (!allowed(need, identity !== null, member)) {
        return fail(403, "You do not have access to this yet.");
      }
      return await handler({ req, log, identity, member, pool });
    } catch (err) {
      if (isWakingUp(err)) {
        resetPool();
        return { status: 503, headers: { "Retry-After": "8", "Cache-Control": "no-store" }, jsonBody: { error: "Waking up. Please try again in a moment.", waking: true } };
      }
      log.error("Request failed", err);
      return fail(500, "Something went wrong on our side.");
    }
  };
}

export async function readBody(req: HttpRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
