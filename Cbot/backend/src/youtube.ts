import type { youtube_v3 } from "googleapis";
import { getYouTubeClient } from "./auth.js";

export type CreateBroadcastResult = {
  broadcastId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string;
  watchUrl: string;
  title: string;
};

function mapYouTubeError(error: unknown): never {
  const err = error as {
    response?: { data?: { error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> } } };
    message?: string;
  };
  const reason = err.response?.data?.error?.errors?.[0]?.reason;
  const message =
    err.response?.data?.error?.message ?? err.message ?? "YouTube API error";

  if (reason === "concurrentBroadcastsExceedLimit") {
    throw new Error("Too many live streams on this channel right now. Try again later.");
  }
  if (reason === "userBroadcastsExceedLimit") {
    throw new Error("Too many scheduled or live broadcasts on this channel. End old streams first.");
  }
  if (reason === "userRequestsExceedRateLimit") {
    throw new Error("YouTube rate limit reached. Please wait and try again.");
  }

  throw new Error(message);
}

export async function createLiveSession(name: string, day: string): Promise<CreateBroadcastResult> {
  const youtube = getYouTubeClient();
  const title = `${name} - ${day}`;
  const scheduledStartTime = new Date().toISOString();

  let broadcast: youtube_v3.Schema$LiveBroadcast;
  let stream: youtube_v3.Schema$LiveStream;

  try {
    const broadcastResponse = await youtube.liveBroadcasts.insert({
      part: ["snippet", "status", "contentDetails"],
      requestBody: {
        snippet: {
          title,
          scheduledStartTime,
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          enableDvr: true,
          recordFromStart: true,
        },
      },
    });
    broadcast = broadcastResponse.data;

    const streamResponse = await youtube.liveStreams.insert({
      part: ["snippet", "cdn"],
      requestBody: {
        snippet: { title: `${title} stream` },
        cdn: {
          frameRate: "30fps",
          ingestionType: "rtmp",
          resolution: "720p",
        },
      },
    });
    stream = streamResponse.data;

    await youtube.liveBroadcasts.bind({
      id: broadcast.id!,
      part: ["id", "snippet", "contentDetails", "status"],
      streamId: stream.id!,
    });
  } catch (error) {
    mapYouTubeError(error);
  }

  const ingestionAddress = stream!.cdn?.ingestionInfo?.ingestionAddress;
  const streamName = stream!.cdn?.ingestionInfo?.streamName;

  if (!broadcast!.id || !stream!.id || !ingestionAddress || !streamName) {
    throw new Error("YouTube did not return complete stream credentials.");
  }

  return {
    broadcastId: broadcast!.id,
    streamId: stream!.id,
    ingestionAddress,
    streamName,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast!.id}`,
    title,
  };
}

export async function transitionBroadcast(
  broadcastId: string,
  status: "live" | "complete" | "testing",
): Promise<void> {
  const youtube = getYouTubeClient();
  const maxAttempts = status === "live" ? 12 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await youtube.liveBroadcasts.transition({
        broadcastStatus: status,
        id: broadcastId,
        part: ["id", "status"],
      });
      return;
    } catch (error) {
      if (status !== "live" || attempt === maxAttempts - 1) {
        mapYouTubeError(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

export async function getBroadcastStatus(broadcastId: string) {
  const youtube = getYouTubeClient();
  try {
    const response = await youtube.liveBroadcasts.list({
      id: [broadcastId],
      part: ["id", "status", "snippet"],
    });
    return response.data.items?.[0] ?? null;
  } catch (error) {
    mapYouTubeError(error);
  }
}
