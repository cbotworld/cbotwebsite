import { useEffect, useState } from "react";
import { Dimensions } from "react-native";
import { getOptionalScreenOrientation } from "../utils/optionalScreenOrientation";
import { getStreamOrientation, type StreamOrientation } from "../utils/streamOrientation";

function mapNativeOrientation(value: number): StreamOrientation | null {
  const module = getOptionalScreenOrientation();
  if (!module) return null;

  if (
    value === module.Orientation.LANDSCAPE_LEFT ||
    value === module.Orientation.LANDSCAPE_RIGHT
  ) {
    return "landscape";
  }

  if (value === module.Orientation.PORTRAIT_UP || value === module.Orientation.PORTRAIT_DOWN) {
    return "portrait";
  }

  return null;
}

export function useDeviceOrientation(windowWidth: number, windowHeight: number): StreamOrientation {
  const [orientation, setOrientation] = useState<StreamOrientation>(() =>
    getStreamOrientation(windowWidth, windowHeight),
  );

  useEffect(() => {
    setOrientation(getStreamOrientation(windowWidth, windowHeight));
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setOrientation(getStreamOrientation(window.width, window.height));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const module = getOptionalScreenOrientation();
    if (!module) return undefined;

    void module.getOrientationAsync().then((value) => {
      const mapped = mapNativeOrientation(value);
      if (mapped) setOrientation(mapped);
    });

    const subscription = module.addOrientationChangeListener((event) => {
      const mapped = mapNativeOrientation(event.orientationInfo.orientation);
      if (mapped) setOrientation(mapped);
    });

    return () => subscription.remove();
  }, []);

  return orientation;
}
