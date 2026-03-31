import "dotenv/config";

import { buildServer } from "./server.js";

const { app, config, gateway } = await buildServer();

await app.listen({ host: config.host, port: config.port });

app.log.info(`frontend-llm-gateway listening on http://${config.host}:${config.port}`);

// Auto-open sessions for all providers with persisted profiles.
// Fire-and-forget — the frontend status polling picks up the resulting state.
// Errors are non-fatal: the user can always login manually from the dashboard.
setImmediate(() => {
  gateway.autoLogin().catch((err: unknown) => {
    app.log.warn(`[autoLogin] errore: ${err instanceof Error ? err.message : String(err)}`);
  });
});
