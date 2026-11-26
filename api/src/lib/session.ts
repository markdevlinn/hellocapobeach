import { createHash, randomBytes } from "node:crypto";
import { Cookie } from "@azure/functions";
import { sql } from "./db";
import { Identity } from "./auth";
import { SESSION_COOKIE, SESSION_DAYS } from "./rules";

// "Stay signed in": after an emailed-code sign-in, the device gets a random
// token in a cookie that page scripts cannot read. The database keeps only a
// SHA-256 fingerprint of it.

const hash = (token: string): Buffer => createHash("sha256").update(token).digest();

export interface Session {
  subject: string;
  email: string | null;
  expiresAt: Date;
}

export function sessionCookie(token: string): Cookie {
  return { name: SESSION_COOKIE, value: token, path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

export function clearedCookie(): Cookie {
  return { name: SESSION_COOKIE, value: "", path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: 0 };
}

export async function createSession(pool: sql.ConnectionPool, who: Identity, userAgent: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool
    .request()
    .input("hash", sql.VarBinary(32), hash(token))
    .input("subject", sql.NVarChar(128), who.subject)
    .input("email", sql.NVarChar(254), who.email)
    .input("agent", sql.NVarChar(200), userAgent ? userAgent.slice(0, 200) : null)
    .input("days", sql.Int, SESSION_DAYS)
    .query(
      `insert into dbo.sessions (token_hash, auth_subject, email, user_agent, expires_at)
       values (@hash, @subject, @email, @agent, dateadd(day, @days, sysutcdatetime()))`
    );
  return token;
}

export async function findSession(pool: sql.ConnectionPool, token: string): Promise<Session | null> {
  const r = await pool
    .request()
    .input("hash", sql.VarBinary(32), hash(token))
    .query<{ auth_subject: string; email: string | null; expires_at: Date }>(
      `select auth_subject, email, expires_at from dbo.sessions
       where token_hash = @hash and revoked_at is null and expires_at > sysutcdatetime()`
    );
  const row = r.recordset[0];
  return row ? { subject: row.auth_subject, email: row.email, expiresAt: row.expires_at } : null;
}

/** Starts the 90 days over for a device that is still being used. */
export async function renewSession(pool: sql.ConnectionPool, token: string): Promise<void> {
  await pool
    .request()
    .input("hash", sql.VarBinary(32), hash(token))
    .input("days", sql.Int, SESSION_DAYS)
    .query(
      `update dbo.sessions set expires_at = dateadd(day, @days, sysutcdatetime()), last_seen_at = sysutcdatetime()
       where token_hash = @hash and revoked_at is null`
    );
}

export async function revokeSession(pool: sql.ConnectionPool, token: string): Promise<void> {
  await pool
    .request()
    .input("hash", sql.VarBinary(32), hash(token))
    .query("update dbo.sessions set revoked_at = sysutcdatetime() where token_hash = @hash and revoked_at is null");
}
