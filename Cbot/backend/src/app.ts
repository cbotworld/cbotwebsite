import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { exchangeCodeForTokens, getAuthUrl } from "./auth.js";
import { broadcastsRouter } from "./routes/broadcasts.js";
import { getConnectedSchedule } from "./schedule.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in (err as object)) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  next(err);
});

app.get("/", (_req, res) => {
  res.json({ app: "Cbot API", health: "/health" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "Cbot Backend" });
});

app.get("/schedule", async (_req, res) => {
  try {
    const schedule = await getConnectedSchedule();
    res.json({ ok: true, ...schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schedule";
    res.status(502).json({ error: message });
  }
});

app.get("/auth/debug", (_req, res) => {
  res.json({
    redirectUri: config.googleRedirectUri,
    hasClientId: Boolean(config.googleClientId),
    hasClientSecret: Boolean(config.googleClientSecret),
    hint: "Add redirectUri exactly to Google Cloud → OAuth → Authorized redirect URIs",
  });
});

app.get("/auth/youtube", (_req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    res.status(500).send("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.");
    return;
  }
  res.redirect(getAuthUrl());
});

app.get("/auth/youtube/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    res.status(400).send(`Google OAuth error: ${error}. <a href="/auth/youtube">Try again</a>`);
    return;
  }

  if (!code) {
    res
      .status(400)
      .type("html")
      .send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:24px;">
        <h1>Missing authorization code</h1>
        <p>Do not open this page directly. Start the YouTube sign-in flow here:</p>
        <p><a href="/auth/youtube">Sign in with Google</a></p>
      </body></html>`);
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    res
      .type("html")
      .send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:24px;">
        <h1>Cbot — YouTube authorized</h1>
        <p>Copy this refresh token into your <code>YOUTUBE_REFRESH_TOKEN</code> env var (Vercel dashboard or local .env):</p>
        <pre style="background:#f4f4f4;padding:16px;overflow:auto;">${tokens.refresh_token ?? "(no refresh token — revoke app access and try again)"}</pre>
        <p>Redeploy or restart the backend after saving.</p>
      </body></html>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";
    res.status(500).send(message);
  }
});

app.use("/broadcasts", broadcastsRouter);
