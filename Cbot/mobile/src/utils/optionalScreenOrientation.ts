import { NativeModules } from "react-native";
import type * as ScreenOrientationModule from "expo-screen-orientation";

type ScreenOrientationApi = typeof ScreenOrientationModule;

let cachedModule: ScreenOrientationApi | null | undefined;

export function getOptionalScreenOrientation(): ScreenOrientationApi | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  if (!NativeModules.ExpoScreenOrientation) {
    cachedModule = null;
    return cachedModule;
  }

  try {
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
