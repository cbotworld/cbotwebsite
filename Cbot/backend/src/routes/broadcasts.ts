import { Router } from "express";
import { assertRuntimeConfig, assertYouTubeConfig } from "../config.js";
import { requireAppKey } from "../middleware/appKey.js";
import {
  createLiveSession,
  getBroadcastStatus,
  transitionBroadcast,
} from "../youtube.js";

export const broadcastsRouter = Router();

broadcastsRouter.use((req, res, next) => {
  try {
    assertRuntimeConfig();
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server misconfigured";
    res.status(500).json({ error: message });
  }
});

broadcastsRouter.use(requireAppKey);

broadcastsRouter.post("/", async (req, res) => {
  try {
    assertYouTubeConfig();
    const { name, day } = req.body as { name?: string; day?: string };

    if (!name?.trim() || !day?.trim()) {
      res.status(400).json({ error: "Both name and day are required." });
      return;
    }

    const session = await createLiveSession(name.trim(), day.trim());
    const secureIngestion = session.ingestionAddress.replace(/^rtmp:\/\//i, "rtmps://");
    res.json({
      ...session,
      ingestionAddress: secureIngestion,
      rtmpUrl: `${secureIngestion}/${session.streamName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create broadcast";
    res.status(502).json({ error: message });
  }
});

broadcastsRouter.post("/:id/go-live", async (req, res) => {
  try {
    assertYouTubeConfig();
    await transitionBroadcast(req.params.id, "live");
    res.json({ ok: true, status: "live" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to go live";
    res.status(502).json({ error: message });
  }
});

broadcastsRouter.post("/:id/end", async (req, res) => {
  try {
    assertYouTubeConfig();
    await transitionBroadcast(req.params.id, "complete");
    res.json({ ok: true, status: "complete" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end broadcast";
    res.status(502).json({ error: message });
  }
});

broadcastsRouter.get("/:id/status", async (req, res) => {
  try {
    assertYouTubeConfig();
    const broadcast = await getBroadcastStatus(req.params.id);
    if (!broadcast) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
    res.json({
      id: broadcast.id,
      title: broadcast.snippet?.title,
      lifeCycleStatus: broadcast.status?.lifeCycleStatus,
      privacyStatus: broadcast.status?.privacyStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get status";
    res.status(502).json({ error: message });
  }
});
