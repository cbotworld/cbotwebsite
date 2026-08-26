export type StreamOrientation = "landscape" | "portrait";

export function getStreamOrientation(windowWidth: number, windowHeight: number): StreamOrientation {
  return windowWidth > windowHeight ? "landscape" : "portrait";
}

export function getVideoDimensions(orientation: StreamOrientation) {
  if (orientation === "landscape") {
    return { videoWidth: 1280, videoHeight: 720 };
  }
  return { videoWidth: 720, videoHeight: 1280 };
}

export function getPreviewFrameSize(
  windowWidth: number,
  windowHeight: number,
  orientation: StreamOrientation,
  controlsHeight: number,
) {
  if (orientation === "landscape") {
    const sidePanelWidth = 260;
    const maxWidth = windowWidth - sidePanelWidth - 32;
    const maxHeight = windowHeight - 24;
    let previewFrameWidth = maxWidth;
    let previewFrameHeight = (previewFrameWidth * 9) / 16;
    if (previewFrameHeight > maxHeight) {
      previewFrameHeight = maxHeight;
      previewFrameWidth = (previewFrameHeight * 16) / 9;
    }
    return { previewFrameWidth, previewFrameHeight, sidePanelWidth };
  }

  const maxWidth = windowWidth - 32;
  const maxHeight = windowHeight - controlsHeight - 32;
  let previewFrameWidth = maxWidth;
  let previewFrameHeight = (previewFrameWidth * 16) / 9;
  if (previewFrameHeight > maxHeight) {
    previewFrameHeight = maxHeight;
    previewFrameWidth = (previewFrameHeight * 9) / 16;
  }
  return { previewFrameWidth, previewFrameHeight, sidePanelWidth: 0 };
}
