import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ExpoLiveStreamPublisherView,
  useLiveStream,
  VideoQuality,
  type StreamState,
} from "expo-live-stream";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { createBroadcast, endBroadcast, goLive, type BroadcastSession } from "../api/client";
import { getSession } from "../api/website";
import { config } from "../config";
import { startLiveKeepAlive, stopLiveKeepAlive } from "../../modules/live-keep-alive";
import { StreamOverlay } from "../components/StreamOverlay";
import { RootStackParamList } from "../navigation/types";
import { lockAppOrientation, unlockAppOrientation } from "../utils/optionalScreenOrientation";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Live">;

const MAX_CAMERA_RETRIES = 30;
const RETRY_DELAY_MS = 1000;
const LIVE_VIDEO_WIDTH = 1280;
const LIVE_VIDEO_HEIGHT = 720;
const AUTO_DIM_DELAY_MS = 30000; // 30 seconds inactivity dimming

function toSecureIngestionUrl(address: string): string {
  return address.replace(/^rtmp:\/\//i, "rtmps://");
}

/**
 * HaishinKit 2.0 on iOS has a known TLS socket bug with rtmps:// connections
 * (RTMPConnection.Error error 1 = socketErrorOccurred). YouTube still accepts
 * plain rtmp:// on port 1935, so we downgrade to plain RTMP on iOS only.
 * Android uses RootEncoder which handles rtmps:// correctly.
 */
function toPlainIngestionUrl(address: string): string {
  return address.replace(/^rtmps:\/\//i, "rtmp://");
}

function LiveIndicator({
  duration,
  bitrate,
  top,
  left,
}: {
  duration?: string;
  bitrate?: number;
  top: number;
  left: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.2, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const bitrateLabel =
    typeof bitrate === "number" && bitrate > 0
      ? bitrate >= 1000
        ? `${(bitrate / 1000).toFixed(1)} Mbps`
        : `${bitrate} kbps`
      : null;

  return (
    <View style={[styles.liveBadge, { top, left }]} pointerEvents="none">
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Text style={styles.liveBadgeText}>LIVE</Text>
      {duration ? <Text style={styles.liveBadgeTime}>{duration}</Text> : null}
      {bitrateLabel ? (
        <View style={styles.bitrateChip}>
          <Text style={styles.bitrateText}>{bitrateLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Pill status bar shown below the live badge
function StatusPill({ text, type }: { text: string; type: "info" | "warn" | "error" }) {
  const bg =
    type === "error"
      ? "rgba(239,68,68,0.85)"
      : type === "warn"
        ? "rgba(245,158,11,0.85)"
        : "rgba(15,23,42,0.75)";
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={styles.statusPillText}>{text}</Text>
    </View>
  );
}

export function LiveScreen({ route, navigation }: Props) {
  const name = route.params?.name || "Player";
  const day = route.params?.day || "Day";
  const teamName = route.params?.teamName || "";
  const opponentName = route.params?.opponentName || "";
  const teamTag = route.params?.teamTag || "";
  const opponentTag = route.params?.opponentTag || "";
  const stage = route.params?.stage || "";
  const editionTitle = route.params?.editionTitle || "";
  const timeRange = route.params?.timeRange || "";
  const endIso = route.params?.endIso || "";
  const playMode = route.params?.playMode || "match";
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topInset = Math.max(insets.top, 12);
  const bottomInset = Math.max(insets.bottom, 16);
  const leftInset = Math.max(insets.left, 8);
  const rightInset = Math.max(insets.right, 8);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [session, setSession] = useState<BroadcastSession | null>(null);
  const [statusText, setStatusText] = useState("");
  const [statusType, setStatusType] = useState<"info" | "warn" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [stopped, setStopped] = useState(false); // show post-stream "ended" screen
  const [orientationLocked, setOrientationLocked] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDimmed, setIsDimmed] = useState(false);

  const dimAnim = useRef(new Animated.Value(0)).current;
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<BroadcastSession | null>(null);
  const goLiveCalledRef = useRef(false);
  const muteAppliedRef = useRef(false);
  const isMutedRef = useRef(true);
  isMutedRef.current = isMuted;
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const allowLeaveRef = useRef(false);

  const resetDimTimer = useCallback(() => {
    if (dimTimerRef.current) {
      clearTimeout(dimTimerRef.current);
      dimTimerRef.current = null;
    }
    setIsDimmed(false);
    Animated.timing(dimAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Inactivity dim timer runs only when live streaming or session active
    if (sessionRef.current || streamStartRef.current) {
      dimTimerRef.current = setTimeout(() => {
        setIsDimmed(true);
        Animated.timing(dimAnim, {
          toValue: 0.92,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, AUTO_DIM_DELAY_MS);
    }
  }, [dimAnim]);

  const handleUserActivity = useCallback(() => {
    resetDimTimer();
  }, [resetDimTimer]);

  const startCountdown = useCallback((seconds: number = 5) => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(seconds);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const stream = useLiveStream({
    autoStopOnUnmount: true,
    reconnect: { enabled: true, maxRetries: 8, initialDelay: 1000, maxDelay: 15000 },
  });
  const streamStartRef = useRef(stream.start);
  streamStartRef.current = stream.start;
  const streamStopRef = useRef(stream.stop);
  streamStopRef.current = stream.stop;
  const streamSwitchRef = useRef(stream.switchCamera);
  streamSwitchRef.current = stream.switchCamera;
  const streamToggleMuteRef = useRef(stream.toggleMute);
  streamToggleMuteRef.current = stream.toggleMute;

  const setStatus = useCallback(
    (text: string, type: "info" | "warn" | "error" = "info") => {
      setStatusText(text);
      setStatusType(type);
    },
    [],
  );

  useEffect(() => {
    return () => {
      clearCountdown();
      if (dimTimerRef.current) {
        clearTimeout(dimTimerRef.current);
        dimTimerRef.current = null;
      }
    };
  }, [clearCountdown]);

  // Manage dimming lifecycle based on session & streaming
  useEffect(() => {
    if (session || stream.isStreaming) {
      resetDimTimer();
    } else {
      if (dimTimerRef.current) {
        clearTimeout(dimTimerRef.current);
        dimTimerRef.current = null;
      }
      setIsDimmed(false);
      dimAnim.setValue(0);
    }
  }, [dimAnim, resetDimTimer, session, stream.isStreaming]);

  useEffect(() => {
    if (!getSession()?.token) {
      navigation.replace("Main");
    }
  }, [navigation]);

  useEffect(() => {
    requestCameraPermission();
    requestMicPermission();
    void lockAppOrientation("landscape").then((locked) => {
      setOrientationLocked(locked);
      if (!locked) {
        console.warn("[LiveScreen] Orientation lock failed — will use transform fallback");
      }
    });
    return () => {
      void lockAppOrientation("portrait");
    };
  }, [requestCameraPermission, requestMicPermission]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !session });
  }, [navigation, session]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    void (async () => {
      if (Platform.OS === "android" && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch {
          // Optional — stream continues without notification permission.
        }
      }
      if (cancelled) return;
      const token = getSession()?.token;
      try {
        await startLiveKeepAlive({
          title: "CBOT Live",
          body: `${name}  •  ${day}`,
          endUrl: `${config.apiBaseUrl}/broadcasts/${session.broadcastId}/end`,
          authorization: token ? `Bearer ${token}` : "",
          apiKey: config.appApiKey,
        });
      } catch {
        // Keep-alive is optional; stream continues.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day, name, session]);

  useEffect(() => {
    return () => {
      void stopLiveKeepAlive();
    };
  }, []);

  useEffect(() => {
    const recording = Boolean(session);
    if (!recording) {
      deactivateKeepAwake("cbot-live");
      return;
    }
    void activateKeepAwakeAsync("cbot-live");
    return () => {
      deactivateKeepAwake("cbot-live");
    };
  }, [session]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const applyDefaultMute = useCallback(() => {
    if (!isMutedRef.current || muteAppliedRef.current) return;
    muteAppliedRef.current = true;
    streamToggleMuteRef.current();
  }, []);

  const triggerGoLive = useCallback(
    async (broadcastId: string) => {
      if (goLiveCalledRef.current) return;
      goLiveCalledRef.current = true;
      startCountdown(5);
      setStatus("Going live on YouTube…", "info");

      try {
        await goLive(broadcastId);
        clearCountdown();
        setStatus("🔴 Live on YouTube", "info");
      } catch (error) {
        clearCountdown();
        const message = error instanceof Error ? error.message : "Go live request failed";
        setStatus("Streaming — YouTube may take a moment", "warn");
        console.warn("goLive:", message);
      } finally {
        setBusy(false);
      }
    },
    [clearCountdown, setStatus, startCountdown],
  );

  const scheduleStartAttempt = useCallback(() => {
    clearRetryTimer();
    if (cancelledRef.current || !sessionRef.current) return;

    retryTimerRef.current = setTimeout(() => {
      const current = sessionRef.current;
      if (!current || cancelledRef.current) return;

      retryCountRef.current += 1;
      if (retryCountRef.current > MAX_CAMERA_RETRIES) {
        setStatus("Camera failed to start — tap Stop and try again", "error");
        setBusy(false);
        const failed = sessionRef.current;
        void (async () => {
          await stopLiveKeepAlive();
          if (failed?.broadcastId) {
            try {
              await endBroadcast(failed.broadcastId);
            } catch {
              // Ignore.
            }
          }
          setSession(null);
        })();
        return;
      }

      setStatus(
        retryCountRef.current === 1
          ? "Starting camera…"
          : `Starting camera (${retryCountRef.current}/${MAX_CAMERA_RETRIES})…`,
        "info",
      );
      streamStartRef.current();
    }, RETRY_DELAY_MS);
  }, [clearRetryTimer, setStatus]);

  useEffect(() => {
    if (!session) return undefined;

    cancelledRef.current = false;
    goLiveCalledRef.current = false;
    muteAppliedRef.current = false;
    retryCountRef.current = 0;
    clearRetryTimer();
    scheduleStartAttempt();

    return () => {
      cancelledRef.current = true;
      clearRetryTimer();
    };
  }, [session?.broadcastId, clearRetryTimer, scheduleStartAttempt]);

  const handleStreamStateChanged = useCallback(
    (event: { nativeEvent: { state: StreamState } }) => {
      stream.handleStreamStateChanged(event);
      const newState = event.nativeEvent.state;

      if (newState === "streaming" && sessionRef.current && !goLiveCalledRef.current) {
        clearRetryTimer();
        applyDefaultMute();
        void triggerGoLive(sessionRef.current.broadcastId);
      }
    },
    [applyDefaultMute, clearRetryTimer, stream, triggerGoLive],
  );

  const handleConnectionFailed = useCallback(
    (event: { nativeEvent: { msg: string } }) => {
      stream.handleConnectionFailed(event);
      const message = event.nativeEvent.msg ?? "RTMP connection failed";
      console.warn(
        "[LiveScreen] Connection failed —",
        "msg:", message,
        "retryCount:", retryCountRef.current,
        "platform:", Platform.OS,
      );

      // Camera not ready — retry silently (up to MAX_CAMERA_RETRIES)
      if (message === "Camera not ready" && retryCountRef.current < MAX_CAMERA_RETRIES) {
        scheduleStartAttempt();
        return;
      }

      // On iOS, also retry RTMP connection errors a few times
      // (transient socket errors can happen even with plain rtmp://)
      if (
        Platform.OS === "ios" &&
        retryCountRef.current < 5 &&
        (message.includes("RTMPConnection") || message.includes("socket") || message.includes("Error error"))
      ) {
        console.log("[LiveScreen] iOS RTMP error — scheduling retry", retryCountRef.current + 1);
        setStatus(`Reconnecting (${retryCountRef.current + 1}/5)…`, "warn");
        scheduleStartAttempt();
        return;
      }

      // All other connection errors — show inline, no alert popup
      setStatus(message, "error");
      setBusy(false);
    },
    [scheduleStartAttempt, setStatus, stream],
  );

  const handleConnectionSuccess = useCallback(
    (event: unknown) => {
      stream.handleConnectionSuccess(event);
      clearRetryTimer();
      applyDefaultMute();
    },
    [applyDefaultMute, clearRetryTimer, stream],
  );

  const hasPermissions = cameraPermission?.granted && micPermission?.granted;

  const handleGoLive = useCallback(async () => {
    if (busy || stream.isStreaming) return;
    setBusy(true);
    setStopped(false);
    setStatus("Creating YouTube broadcast…", "info");
    allowLeaveRef.current = false;

    try {
      const payload = {
        name,
        day,
        teamName,
        opponentName,
        teamTag,
        opponentTag,
        stage,
        editionTitle,
        timeRange,
        endIso,
        playMode,
      };
      const created = await createBroadcast(payload);
      console.log(
        "[LiveScreen] Broadcast created —",
        "platform:", Platform.OS,
        "rawIngestion:", created.ingestionAddress,
        "streamName:", created.streamName,
      );
      setSession(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create broadcast";
      setStatus(message, "error");
      setBusy(false);
    }
  }, [
    busy,
    day,
    editionTitle,
    endIso,
    name,
    opponentName,
    opponentTag,
    playMode,
    setStatus,
    stage,
    stream.isStreaming,
    teamName,
    teamTag,
    timeRange,
  ]);

  const stopCurrentStream = useCallback(async () => {
    cancelledRef.current = true;
    clearRetryTimer();
    // Safe stop — swallow any HaishinKit state machine errors
    try {
      streamStopRef.current();
    } catch (err) {
      console.warn("streamStop swallowed:", err);
    }
    await stopLiveKeepAlive();
    const broadcastId = sessionRef.current?.broadcastId;
    if (broadcastId) {
      // Safe end — swallow errors so teardown always completes
      try {
        await endBroadcast(broadcastId);
      } catch (err) {
        console.warn("endBroadcast swallowed:", err);
      }
    }
    setSession(null);
    setIsFrontCamera(false);
    setIsMuted(true);
    muteAppliedRef.current = false;
    goLiveCalledRef.current = false;
    retryCountRef.current = 0;
  }, [clearRetryTimer]);

  const handleStop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Stopping stream…", "info");

    try {
      await stopCurrentStream();
      allowLeaveRef.current = true;
      setStopped(true); // show "ended" screen — no Alert popup
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop stream";
      setStatus(message, "error");
    } finally {
      setBusy(false);
    }
  }, [busy, setStatus, stopCurrentStream]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowLeaveRef.current || !sessionRef.current) return;
      event.preventDefault();
      // Inline confirm without Alert by immediately stopping
      void (async () => {
        setBusy(true);
        setStatus("Stopping stream…", "info");
        try {
          await stopCurrentStream();
        } catch {
          // Continue leaving regardless
        } finally {
          setBusy(false);
        }
        void lockAppOrientation("portrait");
        allowLeaveRef.current = true;
        navigation.dispatch(event.data.action);
      })();
    });
    return unsubscribe;
  }, [navigation, setStatus, stopCurrentStream]);

  const handleFlipCamera = useCallback(() => {
    streamSwitchRef.current();
    setIsFrontCamera((current) => !current);
  }, []);

  const handleToggleMute = useCallback(() => {
    streamToggleMuteRef.current();
    setIsMuted((current) => {
      const next = !current;
      if (next) {
        muteAppliedRef.current = true;
      }
      return next;
    });
  }, []);

  if (!hasPermissions) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: topInset, paddingBottom: bottomInset, paddingLeft: leftInset, paddingRight: rightInset },
        ]}
      >
        <Text style={styles.permTitle}>Camera & Mic Access Needed</Text>
        <Text style={styles.permissionText}>Grant camera and microphone access to start streaming.</Text>
        <Pressable
          style={styles.goLiveButton}
          onPress={() => {
            requestCameraPermission();
            requestMicPermission();
          }}
        >
          <Text style={styles.recordButtonText}>GRANT ACCESS</Text>
        </Pressable>
      </View>
    );
  }

  // ── Post-stream "ended" screen ──────────────────────────────────────────────
  if (stopped) {
    return (
      <View style={styles.endedScreen}>
        <View style={styles.endedCard}>
          <Text style={styles.endedIcon}>✅</Text>
          <Text style={styles.endedTitle}>Stream Ended</Text>
          <Text style={styles.endedSub}>
            Great job! Your video will appear on the YouTube channel in a few minutes.
          </Text>
          <Text style={styles.endedDay}>{day}</Text>
          <Pressable
            style={styles.endedBtn}
            onPress={() => {
              void lockAppOrientation("portrait");
              navigation.navigate(getSession()?.token ? "Main" : "Login");
            }}
          >
            <Text style={styles.endedBtnText}>BACK TO DASHBOARD</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ingestionUrl = session
    ? Platform.OS === "ios"
      ? toPlainIngestionUrl(session.ingestionAddress)   // iOS: rtmp:// (HaishinKit TLS bug)
      : toSecureIngestionUrl(session.ingestionAddress)  // Android: rtmps://
    : "";

  // Diagnostic: log the final URL being passed to the native RTMP publisher
  if (session && ingestionUrl) {
    console.log(
      "[LiveScreen] Using ingestion URL:",
      ingestionUrl,
      "| streamKey:", session.streamName,
      "| platform:", Platform.OS,
    );
  }
  const showStop = stream.isStreaming || Boolean(session);
  const goHome = () => {
    void lockAppOrientation("portrait");
    if (session) {
      void handleStop();
    } else {
      navigation.navigate(getSession()?.token ? "Main" : "Login");
    }
  };
  const bitrateKbps = typeof stream.statistics?.bitrate === "number" ? stream.statistics.bitrate : undefined;

  return (
    <View
      style={styles.container}
      onStartShouldSetResponderCapture={() => {
        handleUserActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        handleUserActivity();
        return false;
      }}
    >
      <View style={StyleSheet.absoluteFill}>
        {session ? (
          <ExpoLiveStreamPublisherView
            key={`publisher-${session.broadcastId}`}
            ref={stream.ref}
            style={StyleSheet.absoluteFill}
            url={ingestionUrl}
            streamKey={session.streamName}
            quality={VideoQuality.HD_720P}
            videoWidth={LIVE_VIDEO_WIDTH}
            videoHeight={LIVE_VIDEO_HEIGHT}
            frontCamera={isFrontCamera}
            onStreamStateChanged={handleStreamStateChanged}
            onConnectionFailed={handleConnectionFailed}
            onConnectionSuccess={handleConnectionSuccess}
            onDisconnect={stream.handleDisconnect}
            onBitrateUpdate={stream.handleBitrateUpdate}
          />
        ) : (
          // ── Idle "ready" screen ──────────────────────────────────────────────
          <View style={styles.idleFill}>
            <Text style={styles.placeholderKicker}>READY TO STREAM</Text>
            <Text style={styles.placeholderDay}>{day}</Text>
            {teamName ? (
              <Text style={styles.placeholderMatch}>
                {teamTag || teamName} vs {opponentTag || opponentName}
              </Text>
            ) : null}
            {timeRange ? <Text style={styles.placeholderTime}>{timeRange}</Text> : null}
          </View>
        )}

        {session ? <StreamOverlay day={day} /> : null}

        {/* LIVE badge with bitrate */}
        {stream.isStreaming ? (
          <LiveIndicator
            duration={stream.statistics.durationFormatted}
            bitrate={bitrateKbps}
            top={topInset + 44}
            left={leftInset}
          />
        ) : null}

        {/* Inline status pill (replaces Alert popups) */}
        {statusText ? (
          <View style={[styles.statusPillWrap, { top: stream.isStreaming ? topInset + 90 : topInset + 44 }]}>
            <StatusPill text={statusText} type={statusType} />
          </View>
        ) : null}

        {/* ← BACK / stop-and-leave */}
        <Pressable
          style={[styles.backButton, { top: topInset, left: leftInset }]}
          onPress={goHome}
          accessibilityLabel={session ? "Stop stream and go back" : "Back"}
        >
          <Text style={styles.backButtonText}>← BACK</Text>
        </Pressable>

        {/* Top-right controls */}
        <View style={[styles.topRight, { top: topInset, right: rightInset }]}>
          {session ? (
            <>
              <Pressable
                style={[styles.controlButton, !isMuted && styles.controlButtonActive]}
                onPress={handleToggleMute}
                accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                <View style={styles.controlButtonInner}>
                  <Ionicons
                    name={isMuted ? "mic-off" : "mic"}
                    size={18}
                    color={isMuted ? "#f87171" : "#4ade80"}
                  />
                  <Text style={styles.controlButtonText}>{isMuted ? "Muted" : "Live"}</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.controlButton}
                onPress={handleFlipCamera}
                accessibilityLabel={isFrontCamera ? "Switch to rear camera" : "Switch to front camera"}
              >
                <View style={styles.controlButtonInner}>
                  <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
                  <Text style={styles.controlButtonText}>{isFrontCamera ? "Rear" : "Front"}</Text>
                </View>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: bottomInset, paddingLeft: leftInset, paddingRight: rightInset }]}>
          {!showStop ? (
            <Pressable style={[styles.recordButton, styles.goLiveButton, busy && styles.disabledButton]} disabled={busy} onPress={() => void handleGoLive()}>
              {busy ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.recordButtonText}>
                    {countdown !== null ? `  Going Live (${countdown}s)…` : "  Setting up…"}
                  </Text>
                </View>
              ) : (
                <Text style={styles.recordButtonText}>🔴  GO LIVE</Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={[styles.recordButton, styles.stopButton, busy && styles.disabledButton]} disabled={busy} onPress={() => void handleStop()}>
              {busy ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.recordButtonText}>
                    {countdown !== null ? `  Going Live (${countdown}s)…` : "  Stopping…"}
                  </Text>
                </View>
              ) : (
                <Text style={styles.recordButtonText}>⏹  STOP STREAM</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Auto-Dim Overlay (OLED Battery Saver after 30s inactivity) */}
        <Animated.View
          style={[
            styles.dimOverlay,
            { opacity: dimAnim },
          ]}
          pointerEvents={isDimmed ? "auto" : "none"}
        >
          {isDimmed ? (
            <Pressable style={styles.dimPressable} onPress={handleUserActivity}>
              <View style={styles.dimBadge}>
                <Ionicons name="moon" size={16} color="#38bdf8" />
                <Text style={styles.dimBadgeText}>Screen dimmed • Tap anywhere to wake</Text>
              </View>
            </Pressable>
          ) : null}
        </Animated.View>

        {/* On-screen Countdown Overlay */}
        {countdown !== null ? (
          <View style={styles.countdownOverlay} pointerEvents="none">
            <View style={styles.countdownBadge}>
              <View style={styles.countdownPulseCircle}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
              </View>
              <Text style={styles.countdownTitle}>GOING LIVE</Text>
              <Text style={styles.countdownSub}>Connecting to YouTube…</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // Idle screen
  idleFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#05070d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: 6,
  },
  placeholderKicker: { color: "#f59e0b", fontWeight: "800", letterSpacing: 1.5, fontSize: 11 },
  placeholderDay: { color: "#fff", fontSize: 34, fontWeight: "900", textAlign: "center" },
  placeholderMatch: { color: "#94a3b8", fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: 4 },
  placeholderTime: { color: "#475569", fontSize: 12, fontWeight: "600", textAlign: "center" },

  // Live badge
  liveBadge: {
    position: "absolute",
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveBadgeText: { color: "#fff", fontWeight: "900", letterSpacing: 1.8, fontSize: 13 },
  liveBadgeTime: { color: "#fff", fontWeight: "700", fontSize: 12, opacity: 0.95 },
  bitrateChip: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  bitrateText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Status pill (replaces Alert)
  statusPillWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 25 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxWidth: "85%",
  },
  statusPillText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },

  // Buttons
  backButton: {
    position: "absolute",
    zIndex: 30,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  backButtonText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.6 },
  topRight: { position: "absolute", zIndex: 30, flexDirection: "row", gap: 8 },
  controlButton: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  controlButtonActive: {
    backgroundColor: "rgba(34,197,94,0.25)",
    borderColor: "#22c55e",
  },
  controlButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  controlButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: "center",
    gap: 8,
  },
  busyRow: { flexDirection: "row", alignItems: "center" },
  recordButton: {
    minWidth: 220,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  goLiveButton: { backgroundColor: "#ef4444" },
  stopButton: { backgroundColor: "#7f1d1d" },
  disabledButton: { opacity: 0.65 },
  recordButtonText: { color: "#fff", fontWeight: "900", letterSpacing: 1.6, fontSize: 16 },

  // Permissions screen
  centered: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  permTitle: { color: "#f8fafc", fontWeight: "900", fontSize: 20 },
  permissionText: { color: "#94a3b8", textAlign: "center", fontSize: 14 },

  // Post-stream ended screen
  endedScreen: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center", padding: 24 },
  endedCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    maxWidth: 360,
    width: "100%",
    gap: 10,
  },
  endedIcon: { fontSize: 48 },
  endedTitle: { color: "#f8fafc", fontSize: 26, fontWeight: "900" },
  endedSub: { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 20 },
  endedDay: { color: "#f59e0b", fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  endedBtn: {
    marginTop: 10,
    backgroundColor: "#f59e0b",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "100%",
  },
  endedBtnText: { color: "#0f172a", fontWeight: "900", letterSpacing: 1.2 },

  // General
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "#1e293b",
  },
  buttonText: { color: "#fff", fontWeight: "700" },

  // Countdown Overlay
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  countdownBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.7)",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 14,
    minWidth: 200,
  },
  countdownPulseCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 2,
    borderColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  countdownNumber: {
    color: "#ef4444",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  countdownTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 2,
  },
  countdownSub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  // Auto-Dim (OLED Battery Saver) Overlay
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 35,
  },
  dimPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 48,
  },
  dimBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  dimBadgeText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
