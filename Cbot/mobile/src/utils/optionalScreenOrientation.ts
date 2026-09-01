import type * as ScreenOrientationModule from "expo-screen-orientation";

type ScreenOrientationApi = typeof ScreenOrientationModule;

let cachedModule: ScreenOrientationApi | null | undefined;

export function getOptionalScreenOrientation(): ScreenOrientationApi | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  // Use requireNativeModule detection via expo-modules-core instead of
  // legacy NativeModules which doesn't expose new-architecture Expo modules
  try {
    const { requireNativeModule } = require("expo-modules-core") as {
      requireNativeModule: (name: string) => unknown;
    };
    requireNativeModule("ExpoScreenOrientation"); // throws if not available
    cachedModule = require("expo-screen-orientation") as ScreenOrientationApi;
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}

export async function unlockAppOrientation() {
  const module = getOptionalScreenOrientation();
  if (!module) return;
  await module.unlockAsync();
}

export async function lockAppOrientation(orientation: "portrait" | "landscape"): Promise<boolean> {
  const module = getOptionalScreenOrientation();
  if (!module) {
    console.warn("[ScreenOrientation] Module not available — cannot lock to", orientation);
    return false;
  }

  const lockValue =
    orientation === "landscape"
      ? module.OrientationLock.LANDSCAPE
      : module.OrientationLock.PORTRAIT_UP;

  // First attempt
  try {
    await module.lockAsync(lockValue);
    console.log("[ScreenOrientation] Locked to", orientation);
    return true;
  } catch (err) {
    console.warn("[ScreenOrientation] First lock attempt failed:", err);
  }

  // Retry once after a short delay — iOS sometimes needs a moment after mount
  try {
    await new Promise((r) => setTimeout(r, 400));
    await module.lockAsync(lockValue);
    console.log("[ScreenOrientation] Locked to", orientation, "(retry)");
    return true;
  } catch (err) {
    console.error("[ScreenOrientation] Retry also failed:", err);
    return false;
  }
}

export function hasScreenOrientationSupport() {
  return getOptionalScreenOrientation() !== null;
}
