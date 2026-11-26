import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { identify, Identity } from "./auth";
import { getPool, isWakingUp, resetPool, sql } from "./db";
import { Access, allowed, MemberRole, MemberStatus, readCookie, SESSION_COOKIE } from "./rules";
import { findSession, Session } from "./session";

export interface Member {
  id: string;
  email: string;
  full_name: string;
  status: MemberStatus;
  role: MemberRole;
  in_directory: boolean;
}

export interface Ctx {
  req: HttpRequest;
  log: InvocationContext;
  identity: Identity | null;
  member: Member | null;
  pool: sql.ConnectionPool;
  /** How this request proved who it is: the stay-signed-in cookie, or a fresh sign-in token. */
  via: "session" | "token" | "none";
  /** The stay-signed-in token and its details, when the request used one. */
  sessionToken: string | null;
  session: Session | null;
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
    .query<Member>("select id, email, full_name, status, role, in_directory from dbo.members where auth_subject = @subject");
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
      let via: Ctx["via"] = "none";
      let sessionToken: string | null = null;
      let session: Session | null = null;
      const pool = await getPool();

      // 1. The stay-signed-in cookie. It only counts when the request also carries
      //    our own header, which another website cannot add on a visitor's behalf.
      const cookieToken = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
      if (cookieToken && req.headers.get("x-hcb") === "1") {
        session = await findSession(pool, cookieToken);
        if (session) {
          identity = { subject: session.subject, email: session.email };
          via = "session";
          sessionToken = cookieToken;
        }
      }
      // 2. Otherwise, a fresh sign-in token from Microsoft.
      if (!identity) {
        identity = await identify(req.headers.get("x-hcb-token"), req.headers.get("x-hcb-idtoken"));
        if (identity) via = "token";
      }
      if (need !== "public" && !identity) return fail(401, "Please sign in.");

      const member = identity ? await findMember(pool, identity.subject) : null;
      if (!allowed(need, identity !== null, member)) {
        return fail(403, "You do not have access to this yet.");
      }
      return await handler({ req, log, identity, member, pool, via, sessionToken, session });
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
