import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    (process.env.VERCEL
      ? "https://api.cbotworld.com/auth/youtube/callback"
      : "http://localhost:3000/auth/youtube/callback"),
  youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? "",
  appApiKey: process.env.APP_API_KEY ?? "",
};

export function assertRuntimeConfig(): void {
  if (!process.env.APP_API_KEY) {
    throw new Error("Missing required environment variable: APP_API_KEY");
  }
}

export function assertYouTubeConfig(): void {
  required("GOOGLE_CLIENT_ID");
  required("GOOGLE_CLIENT_SECRET");
  required("YOUTUBE_REFRESH_TOKEN");
}
