import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

// Checks the sign-in token that Microsoft Entra External ID issued to the browser.
// The browser sends it in the X-HCB-Token header (Azure Static Web Apps reserves
// the standard Authorization header for itself).

export interface Identity {
  subject: string; // stable id of the sign-in account
  email: string | null;
}

interface Discovery {
  issuer: string;
  jwks_uri: string;
}

let discovery: Promise<Discovery> | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function settings() {
  const tenantId = process.env.AUTH_TENANT_ID;
  const clientId = process.env.AUTH_CLIENT_ID;
  const host = process.env.AUTH_HOST;
  if (!tenantId || !clientId || !host) throw new Error("Missing sign-in settings");
  return { tenantId, clientId, host };
}

async function getDiscovery(): Promise<Discovery> {
  if (!discovery) {
    const { tenantId, host } = settings();
    const url = `https://${host}/${tenantId}/v2.0/.well-known/openid-configuration`;
    discovery = fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Sign-in configuration returned ${r.status}`);
        return (await r.json()) as Discovery;
      })
      .catch((err) => {
        discovery = null;
        throw err;
      });
  }
  return discovery;
}

async function verify(token: string): Promise<JWTPayload> {
  const { clientId } = settings();
  const d = await getDiscovery();
  if (!jwks) jwks = createRemoteJWKSet(new URL(d.jwks_uri));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: d.issuer,
    audience: [clientId, `api://${clientId}`],
    clockTolerance: 60,
  });
  return payload;
}

function emailFrom(p: JWTPayload): string | null {
  const candidates = [p.email, p.preferred_username, Array.isArray(p.emails) ? p.emails[0] : undefined];
  for (const c of candidates) {
    if (typeof c === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return c.toLowerCase();
  }
  return null;
}

function subjectFrom(p: JWTPayload): string | null {
  const s = typeof p.oid === "string" ? p.oid : typeof p.sub === "string" ? p.sub : null;
  return s && s.length <= 128 ? s : null;
}

/**
 * Returns who is calling, or null when the token is missing or not valid.
 * idToken is optional and only used to read the email address when the main
 * token does not carry one. It must belong to the same account.
 */
export async function identify(token: string | null, idToken: string | null): Promise<Identity | null> {
  if (!token) return null;
  let payload: JWTPayload;
  try {
    payload = await verify(token);
  } catch {
    return null;
  }
  const subject = subjectFrom(payload);
  if (!subject) return null;
  let email = emailFrom(payload);
  if (!email && idToken) {
    try {
      const idPayload = await verify(idToken);
      if (subjectFrom(idPayload) === subject) email = emailFrom(idPayload);
    } catch {
      // ignore: the email simply stays unknown
    }
  }
  return { subject, email };
}
