import { app, HttpResponseInit } from "@azure/functions";

// GET /api/health
// Confirms the API is deployed and answering. Holds no neighbor data.
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async (): Promise<HttpResponseInit> => ({
    status: 200,
    headers: { "Cache-Control": "no-store" },
    jsonBody: { ok: true, service: "hellocapobeach-api" },
  }),
});
