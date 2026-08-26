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
  Alert,
  Animated,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

function toSecureIngestionUrl(address: string): string {
  return address.replace(/^rtmp:\/\//i, "rtmps://");
}

function LiveIndicator({ duration, top, left }: { duration?: string; top: number; left: number }) {
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

  return (
    <View style={[styles.liveBadge, { top, left }]} pointerEvents="none">
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Text style={styles.liveBadgeText}>LIVE</Text>
      {duration ? <Text style={styles.liveBadgeTime}>{duration}</Text> : null}
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
  const topInset = Math.max(insets.top, 12);
  const bottomInset = Math.max(insets.bottom, 16);
  const leftInset = Math.max(insets.left, 8);
  const rightInset = Math.max(insets.right, 8);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [session, setSession] = useState<BroadcastSession | null>(null);
  const [statusText, setStatusText] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [publisherKey, setPublisherKey] = useState(0);

  const sessionRef = useRef<BroadcastSession | null>(null);
  const goLiveCalledRef = useRef(false);
  const muteAppliedRef = useRef(false);
  const isMutedRef = useRef(true);
  isMutedRef.current = isMuted;
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const allowLeaveRef = useRef(false);

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

  useEffect(() => {
    if (!getSession()?.token) {
      navigation.replace("Main");
    }
  }, [navigation]);

  useEffect(() => {
    requestCameraPermission();
    requestMicPermission();
    void lockAppOrientation("landscape");
    return () => {
      void unlockAppOrientation();
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
          // Notification permission is optional; the stream can still continue.
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
        // #region agent log
        fetch('http://127.0.0.1:7508/ingest/db8f6b00-655b-4c36-b33e-ef113afeb684',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de811f'},body:JSON.stringify({sessionId:'de811f',runId:'pre-fix',hypothesisId:'D',location:'LiveScreen.tsx:startKeepAlive',message:'keep-alive start ok',data:{platform:Platform.OS},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7508/ingest/db8f6b00-655b-4c36-b33e-ef113afeb684',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de811f'},body:JSON.stringify({sessionId:'de811f',runId:'pre-fix',hypothesisId:'D',location:'LiveScreen.tsx:startKeepAlive',message:'keep-alive start failed',data:{platform:Platform.OS,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7508/ingest/db8f6b00-655b-4c36-b33e-ef113afeb684',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de811f'},body:JSON.stringify({sessionId:'de811f',runId:'pre-fix',hypothesisId:'C',location:'LiveScreen.tsx:applyDefaultMute',message:'mute on first streaming',data:{isMuted:isMutedRef.current,muteAlreadyApplied:muteAppliedRef.current,willMute:Boolean(isMutedRef.current && !muteAppliedRef.current)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!isMutedRef.current || muteAppliedRef.current) return;
    muteAppliedRef.current = true;
    streamToggleMuteRef.current();
  }, []);

  const triggerGoLive = useCallback(async (broadcastId: string) => {
    if (goLiveCalledRef.current) return;
    goLiveCalledRef.current = true;
    setStatusText("Going live on YouTube...");

    try {
      await goLive(broadcastId);
      setStatusText("Live on YouTube");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Go live request failed";
      setStatusText("Streaming — YouTube may take a moment to go live");
      console.warn("goLive:", message);
    } finally {
      setBusy(false);
    }
  }, []);

  const scheduleStartAttempt = useCallback(() => {
    clearRetryTimer();
    if (cancelledRef.current || !sessionRef.current) return;

    retryTimerRef.current = setTimeout(() => {
      const current = sessionRef.current;
      if (!current || cancelledRef.current) return;

      retryCountRef.current += 1;
      if (retryCountRef.current > MAX_CAMERA_RETRIES) {
        setStatusText("Camera failed to start");
        setBusy(false);
        const failed = sessionRef.current;
        void (async () => {
          await stopLiveKeepAlive();
          if (failed?.broadcastId) {
            try {
              await endBroadcast(failed.broadcastId);
            } catch {
              // Ignore end errors so the player can retry GO LIVE.
            }
          }
          setSession(null);
        })();
        Alert.alert(
          "Camera not ready",
          "Could not start the camera for streaming. Close other camera apps and try again.",
        );
        return;
      }

      setStatusText(
        retryCountRef.current === 1
          ? "Starting camera..."
          : `Starting camera (${retryCountRef.current}/${MAX_CAMERA_RETRIES})...`,
      );
      streamStartRef.current(current.rtmpUrl);
    }, RETRY_DELAY_MS);
  }, [clearRetryTimer]);

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

      if (message === "Camera not ready" && retryCountRef.current < MAX_CAMERA_RETRIES) {
        scheduleStartAttempt();
        return;
      }

      setStatusText(message);
      setBusy(false);
      Alert.alert("Stream connection failed", message);
    },
    [scheduleStartAttempt, stream],
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
    setStatusText("Creating YouTube broadcast...");
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
      // #region agent log
      fetch('http://127.0.0.1:7508/ingest/db8f6b00-655b-4c36-b33e-ef113afeb684',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de811f'},body:JSON.stringify({sessionId:'de811f',runId:'post-fix',hypothesisId:'B',location:'LiveScreen.tsx:handleGoLive',message:'createBroadcast payload',data:{hasTeam:Boolean(teamName),hasOpponent:Boolean(opponentName),hasStage:Boolean(stage),hasWindow:Boolean(timeRange),hasEdition:Boolean(editionTitle),day},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const created = await createBroadcast(payload);
      setSession(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create broadcast";
      setStatusText(message);
      Alert.alert("Go Live failed", message);
      setBusy(false);
    }
  }, [busy, day, editionTitle, endIso, name, opponentName, opponentTag, playMode, stage, stream.isStreaming, teamName, teamTag, timeRange]);

  const stopCurrentStream = useCallback(async () => {
    cancelledRef.current = true;
    clearRetryTimer();
    streamStopRef.current();
    await stopLiveKeepAlive();
    const broadcastId = sessionRef.current?.broadcastId;
    if (broadcastId) {
      await endBroadcast(broadcastId);
    }
    setSession(null);
    setIsFrontCamera(false);
    setIsMuted(true);
    muteAppliedRef.current = false;
    goLiveCalledRef.current = false;
    retryCountRef.current = 0;
    setStatusText("Stream ended. Video will appear on YouTube shortly.");
  }, [clearRetryTimer]);

  const handleStop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatusText("Stopping stream...");

    try {
      await stopCurrentStream();
      allowLeaveRef.current = true;
      Alert.alert(
        "Stream ended",
        "Your recording will appear on the YouTube channel in a few minutes.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate(getSession()?.token ? "Main" : "Login"),
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop stream";
      setStatusText(message);
      Alert.alert("Stop failed", message);
    } finally {
      setBusy(false);
    }
  }, [busy, navigation, stopCurrentStream]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowLeaveRef.current || !sessionRef.current) return;
      event.preventDefault();
      Alert.alert(
        "You are live",
        "Switching to another app keeps the stream going. Leave this screen only after you stop, or close Cbot to end.",
        [
          { text: "Stay live", style: "cancel" },
          {
            text: "Stop and leave",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await stopCurrentStream();
                } catch (error) {
                  Alert.alert("Stop failed", error instanceof Error ? error.message : "Could not stop stream");
                  return;
                }
                allowLeaveRef.current = true;
                navigation.dispatch(event.data.action);
              })();
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, stopCurrentStream]);

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
        <Text style={styles.permissionText}>Camera and microphone access are required.</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            requestCameraPermission();
            requestMicPermission();
          }}
        >
          <Text style={styles.buttonText}>Grant permissions</Text>
        </Pressable>
      </View>
    );
  }

  const ingestionUrl = session ? toSecureIngestionUrl(session.ingestionAddress) : "";
  const showStop = stream.isStreaming || Boolean(session);
  const goHome = () => navigation.navigate(getSession()?.token ? "Main" : "Login");

  return (
    <View style={styles.container}>
      {session ? (
        <ExpoLiveStreamPublisherView
          key={`publisher-${publisherKey}`}
          ref={stream.ref}
          style={StyleSheet.absoluteFill}
          url={ingestionUrl}
          streamKey={session.streamName}
          quality={VideoQuality.HD_720P}
          videoWidth={LIVE_VIDEO_WIDTH}
          videoHeight={LIVE_VIDEO_HEIGHT}
          frontCamera={false}
          onStreamStateChanged={handleStreamStateChanged}
          onConnectionFailed={handleConnectionFailed}
          onConnectionSuccess={handleConnectionSuccess}
          onDisconnect={stream.handleDisconnect}
          onBitrateUpdate={stream.handleBitrateUpdate}
        />
      ) : (
        <View style={styles.idleFill}>
          <Text style={styles.placeholderKicker}>READY TO STREAM</Text>
          <Text style={styles.placeholderDay}>{day}</Text>
        </View>
      )}

      {session ? <StreamOverlay day={day} /> : null}
      {stream.isStreaming ? (
        <LiveIndicator duration={stream.statistics.durationFormatted} top={topInset + 44} left={leftInset} />
      ) : null}

      <Pressable
        style={[styles.backButton, { top: topInset, left: leftInset }]}
        onPress={goHome}
        accessibilityLabel="Back"
      >
        <Text style={styles.backButtonText}>← BACK</Text>
      </Pressable>

      <View style={[styles.topRight, { top: topInset, right: rightInset }]}>
        {session ? (
          <>
            <Pressable
              style={styles.controlButton}
              onPress={handleToggleMute}
              accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              <Text style={styles.controlButtonText}>{isMuted ? "Unmute" : "Mute"}</Text>
            </Pressable>
            <Pressable
              style={styles.controlButton}
              onPress={handleFlipCamera}
              accessibilityLabel={isFrontCamera ? "Switch to rear camera" : "Switch to front camera"}
            >
              <Text style={styles.controlButtonText}>{isFrontCamera ? "Rear" : "Front"}</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset, paddingLeft: leftInset, paddingRight: rightInset }]}>
        {!stream.isStreaming ? <Text style={styles.statusOverlay}>{statusText}</Text> : null}
        {!showStop ? (
          <Pressable style={[styles.recordButton, styles.goLiveButton]} disabled={busy} onPress={handleGoLive}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.recordButtonText}>GO LIVE</Text>}
          </Pressable>
        ) : (
          <Pressable style={[styles.recordButton, styles.stopButton]} disabled={busy} onPress={handleStop}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.recordButtonText}>STOP STREAM</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  idleFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#05070d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  liveBadge: {
    position: "absolute",
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  liveBadgeText: { color: "#fff", fontWeight: "900", letterSpacing: 1.8, fontSize: 14 },
  liveBadgeTime: { color: "#fff", fontWeight: "700", fontSize: 13, opacity: 0.95 },
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
  topRight: {
    position: "absolute",
    zIndex: 30,
    flexDirection: "row",
    gap: 8,
  },
  controlButton: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  controlButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: "center",
    gap: 10,
  },
  statusOverlay: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  recordButton: {
    minWidth: 220,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  goLiveButton: { backgroundColor: "#ef4444" },
  stopButton: { backgroundColor: "#7f1d1d" },
  recordButtonText: { color: "#fff", fontWeight: "900", letterSpacing: 1.6, fontSize: 16 },
  placeholderKicker: { color: "#f59e0b", fontWeight: "800", letterSpacing: 1.5, fontSize: 11, marginBottom: 8 },
  placeholderDay: { color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center" },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "#1e293b",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  centered: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  permissionText: { color: "#e2e8f0", textAlign: "center" },
});
