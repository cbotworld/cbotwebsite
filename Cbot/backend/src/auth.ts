import { google } from "googleapis";
import { config } from "./config.js";

const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function getAuthorizedClient() {
  const client = createOAuthClient();
  client.setCredentials({
    refresh_token: config.youtubeRefreshToken,
  });
  return client;
}

export function getYouTubeClient() {
  const auth = getAuthorizedClient();
  return google.youtube({ version: "v3", auth });
}
