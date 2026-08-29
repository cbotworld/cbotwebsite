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

export async function lockAppOrientation(orientation: "portrait" | "landscape") {
  const module = getOptionalScreenOrientation();
  if (!module) return false;

  await module.lockAsync(
    orientation === "landscape"
      ? module.OrientationLock.LANDSCAPE
      : module.OrientationLock.PORTRAIT_UP,
  );
  return true;
}

export function hasScreenOrientationSupport() {
  return getOptionalScreenOrientation() !== null;
}
