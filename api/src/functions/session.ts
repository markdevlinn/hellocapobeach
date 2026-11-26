import { app } from "@azure/functions";
import { endpoint, json } from "../lib/http";
import { readCookie, SESSION_COOKIE } from "../lib/rules";
import { clearedCookie, createSession, revokeSession, sessionCookie } from "../lib/session";

// POST /api/session
// Called right after an emailed-code sign-in. Remembers this device for 90 days.
app.http("sessionStart", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "session",
  handler: endpoint("signed-in", async ({ req, identity, pool, via }) => {
    // Only a fresh sign-in can start a remembered session. A remembered
    // session cannot be used to mint another one.
    if (via !== "token") return json(200, { remembered: true });
    const token = await createSession(pool, identity!, req.headers.get("user-agent"));
    return { ...json(201, { remembered: true }), cookies: [sessionCookie(token)] };
  }),
});

// POST /api/session/end
// Sign out on this device.
app.http("sessionEnd", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "session/end",
  handler: endpoint("public", async ({ req, pool }) => {
    const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
    if (token) await revokeSession(pool, token);
    return { ...json(200, { ok: true }), cookies: [clearedCookie()] };
  }),
});
