import { app, HttpRequest, HttpResponseInit } from "@azure/functions";

// GET /api/health
// Confirms the API is deployed and answering. Holds no neighbor data.
// "cookies" reports only whether any cookie reached the API, never its contents.
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => ({
    status: 200,
    headers: { "Cache-Control": "no-store" },
    jsonBody: { ok: true, service: "hellocapobeach-api", cookies: (req.headers.get("cookie") ?? "").length > 0 },
  }),
});
