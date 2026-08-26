const websiteBaseUrl = (process.env.EXPO_PUBLIC_WEBSITE_URL ?? "https://www.cbotworld.com").replace(/\/$/, "");

export const config = {
  websiteBaseUrl,
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? `${websiteBaseUrl}/api`).replace(/\/$/, ""),
  appApiKey: process.env.EXPO_PUBLIC_APP_API_KEY ?? "",
};
