import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Share,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import {
  loginPlayer,
  getPlayerMatches,
  createStreamSession,
  stopStreamSession,
  MatchDetails,
  StreamSession,
} from './services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Screen = 'login' | 'matches' | 'live';

interface BoardScore {
  boardNumber: number;
  score: number;
  slams: number; // number of slams on this board
}

function formatISTDate(date: Date): string {
  try {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(date.getDate());
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const mins = pad(date.getMinutes());
    const secs = pad(date.getSeconds());
    return `${day} ${month} ${year} ${hours}:${mins}:${secs} IST`;
  } catch {
    return date.toTimeString().split(' ')[0] + ' IST';
  }
}

export default function App() {
  // Navigation & Auth State
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [playerRole, setPlayerRole] = useState<string>('PLAYER');
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);

  // Login State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Live Stream State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<StreamSession | null>(null);
  const [streamDuration, setStreamDuration] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Camera & Audio Controls (Muted by default)
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isMuted, setIsMuted] = useState(true); // MUTED BY DEFAULT
  const [torch, setTorch] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState(formatISTDate(new Date()));

  // Board-by-Board Scoring System for Player
  const [boards, setBoards] = useState<BoardScore[]>([
    { boardNumber: 1, score: 0, slams: 0 },
    { boardNumber: 2, score: 0, slams: 0 },
    { boardNumber: 3, score: 0, slams: 0 },
  ]);

  // Compute Total Score and Total Slams
  const totalScore = boards.reduce((acc, b) => acc + b.score, 0);
  const totalSlams = boards.reduce((acc, b) => acc + b.slams, 0);

  // Camera & Mic Permissions
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Auto-request permissions on mount
  useEffect(() => {
    (async () => {
      if (!camPermission?.granted && requestCamPermission) {
        await requestCamPermission();
      }
      if (!micPermission?.granted && requestMicPermission) {
        await requestMicPermission();
      }
    })();
  }, [camPermission, micPermission]);

  // Real-time IST Clock Timer
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTimeStr(formatISTDate(new Date()));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Sync match details when a match is selected
  useEffect(() => {
    if (selectedMatch) {
      setBoards([
        { boardNumber: 1, score: 0, slams: 0 },
        { boardNumber: 2, score: 0, slams: 0 },
        { boardNumber: 3, score: 0, slams: 0 },
      ]);
    }
  }, [selectedMatch]);

  // Live duration stopwatch
  useEffect(() => {
    let interval: any = null;
    if (isStreaming) {
      interval = setInterval(() => {
        setStreamDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setStreamDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  // Board scoring modifiers
  const handleModifyBoardScore = (boardNum: number, delta: number) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.boardNumber === boardNum) {
          const newScore = Math.max(0, b.score + delta);
          return { ...b, score: newScore };
        }
        return b;
      })
    );
  };

  const handleModifyBoardSlam = (boardNum: number, delta: number) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.boardNumber === boardNum) {
          const newSlams = Math.max(0, b.slams + delta);
          // A slam awards +12 points in Carrom or points according to tournament rules
          const scoreDiff = delta > 0 ? 12 : (b.slams > 0 ? -12 : 0);
          return { ...b, slams: newSlams, score: Math.max(0, b.score + scoreDiff) };
        }
        return b;
      })
    );
  };

  const handleAddNewBoard = () => {
    setBoards((prev) => [
      ...prev,
      { boardNumber: prev.length + 1, score: 0, slams: 0 },
    ]);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getShareableUrl = () => {
    if (!selectedMatch) return 'https://www.cbotworld.com';
    return `https://www.cbotworld.com/matches/${selectedMatch.matchId}`;
  };

  const handleCopyShareLink = async () => {
    const url = getShareableUrl();
    try {
      await Share.share({
        title: `${selectedMatch?.editionTitle} - ${selectedMatch?.teamName} vs ${selectedMatch?.opponentName}`,
        message: `Watch Live Carrom Match: ${selectedMatch?.teamName} vs ${selectedMatch?.opponentName}\n${url}`,
        url,
      });
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      Alert.alert('Match Link', url);
    }
  };

  const handleOpenWhatsApp = () => {
    const url = getShareableUrl();
    const text = encodeURIComponent(`Watch Live Carrom Match: ${selectedMatch?.teamName} vs ${selectedMatch?.opponentName}\n${url}`);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      Alert.alert('WhatsApp', 'WhatsApp is not installed on this device.');
    });
  };

  const handleLogin = async () => {
    if (!username || !pin) {
      Alert.alert('Error', 'Please enter your username and PIN');
      return;
    }
    setLoading(true);
    try {
      const res = await loginPlayer(username.trim(), pin.trim());
      if (res.success && res.token) {
        setToken(res.token);
        const name = res.user?.name || res.user?.username || username;
        setPlayerName(name);
        setPlayerRole(res.user?.role || 'PLAYER');

        // Fetch matches
        const matchRes = await getPlayerMatches(res.token);
        if (matchRes.success && matchRes.matches) {
          setMatches(matchRes.matches);
        }
        setScreen('matches');
      } else {
        Alert.alert('Login Failed', res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMatch = (match: MatchDetails) => {
    setSelectedMatch(match);
    setScreen('live');
    if (!camPermission?.granted && requestCamPermission) {
      requestCamPermission();
    }
  };

  const handleStartStream = async () => {
    if (!selectedMatch || !token) return;
    setActionLoading(true);
    try {
      const res = await createStreamSession(selectedMatch.matchId, token);
      if (res.success && res.stream) {
        setStreamData(res.stream);
        setIsStreaming(true);
        Alert.alert('🔴 Live Stream Active', 'Match broadcast is now live on YouTube!');
      } else {
        Alert.alert('Error', res.error || 'Failed to start stream');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Stream initiation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopStream = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await stopStreamSession(streamData?.id || 'active', undefined, token);
      if (res.success) {
        setIsStreaming(false);
        setStreamData(null);
        Alert.alert('Match Completed', 'Live broadcast ended and match saved successfully!');
        setScreen('matches');
        // Refresh matches
        const matchRes = await getPlayerMatches(token);
        if (matchRes.success && matchRes.matches) {
          setMatches(matchRes.matches);
        }
      } else {
        Alert.alert('Error', res.error || 'Failed to stop stream');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to stop stream');
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // SCREEN 1: LOGIN SCREEN
  // ==========================================
  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loginContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🏆</Text>
            <Text style={styles.appTitle}>CBOT</Text>
            <Text style={styles.appSubtitle}>LIVE STREAM STUDIO</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formLabel}>USERNAME OR EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. balu or player@cbotworld.com"
              placeholderTextColor="#64748b"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.formLabel}>4-DIGIT PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter PIN"
              placeholderTextColor="#64748b"
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.loginButtonText}>SIGN IN TO ARENA</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>
            Use your standard CBOT Arena player credentials to log in
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================
  // SCREEN 2: MATCHES LIST SCREEN
  // ==========================================
  if (screen === 'matches') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🏆 CBOT ARENA</Text>
            <Text style={styles.headerSubtitle}>
              Player: <Text style={{ color: '#f59e0b', fontWeight: '800' }}>{playerName}</Text> ({playerRole})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerRefreshBtn}
            onPress={async () => {
              if (token) {
                const matchRes = await getPlayerMatches(token);
                if (matchRes.success && matchRes.matches) {
                  setMatches(matchRes.matches);
                }
              }
            }}
          >
            <Text style={styles.headerRefreshText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.matchList} showsVerticalScrollIndicator={false}>
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyText}>No tournament matches found.</Text>
              <Text style={styles.emptySubtext}>
                Scheduled tournament matches will appear here automatically.
              </Text>
            </View>
          ) : (
            matches.map((match) => (
              <TouchableOpacity
                key={match.matchId}
                style={styles.matchCard}
                onPress={() => handleSelectMatch(match)}
                activeOpacity={0.85}
              >
                <View style={styles.matchCardHeader}>
                  <View style={styles.editionBadge}>
                    <Text style={styles.matchEdition}>{match.editionTitle}</Text>
                  </View>
                  <View style={styles.stagePill}>
                    <Text style={styles.stagePillText}>
                      {match.stage || 'LEAGUE'} • R{match.round || 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.teamsRow}>
                  <View style={styles.teamCol}>
                    <View style={styles.teamAvatar}>
                      <Text style={styles.teamAvatarText}>
                        {(match.teamTag || match.teamName || 'T1').slice(0, 3).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.teamNameText} numberOfLines={1}>
                      {match.teamName}
                    </Text>
                  </View>

                  <View style={styles.vsCenter}>
                    <Text style={styles.vsText}>VS</Text>
                    <View style={styles.tableBadge}>
                      <Text style={styles.tableBadgeText}>TABLE #{match.tableNumber}</Text>
                    </View>
                  </View>

                  <View style={styles.teamCol}>
                    <View style={[styles.teamAvatar, { backgroundColor: '#3b82f6' }]}>
                      <Text style={styles.teamAvatarText}>
                        {(match.opponentTag || match.opponentName || 'T2').slice(0, 3).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.teamNameText} numberOfLines={1}>
                      {match.opponentName}
                    </Text>
                  </View>
                </View>

                <View style={styles.goLiveRow}>
                  <Text style={styles.goLiveText}>🔴 ENTER LIVE STUDIO & BROADCAST →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            setScreen('login');
            setToken('');
            setMatches([]);
          }}
        >
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ==========================================
  // SCREEN 3: LIVE STUDIO (EXACT CBOT WEBSITE REPLICA WITH BOARD SCORING)
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.liveScroll} showsVerticalScrollIndicator={false}>
        {/* 1. TOP NAV BAR */}
        <View style={styles.websiteTopNav}>
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => {
              if (isStreaming) {
                Alert.alert('Live Stream Active', 'Please end the match before leaving studio.');
              } else {
                setScreen('matches');
              }
            }}
          >
            <Text style={styles.navBackText}>← Back to Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navShareBtn} onPress={handleCopyShareLink}>
            <Text style={styles.navShareText}>
              {copiedLink ? '✓ Copied Link' : '🔗 Share Link'}
            </Text>
          </TouchableOpacity>

          <View style={styles.navEditionBadge}>
            <Text style={styles.navEditionText} numberOfLines={1}>
              {selectedMatch?.editionTitle}
            </Text>
          </View>
        </View>

        {/* 2. MAIN STUDIO CARD */}
        <View style={styles.studioCard}>
          {/* Header Row */}
          <View style={styles.studioHeaderRow}>
            <View>
              <View style={styles.officialTagRow}>
                <View style={[styles.liveDotSmall, isStreaming && styles.liveDotSmallPulsing]} />
                <Text style={styles.officialTagText}>Official CBOT Live Player Studio</Text>
              </View>
              <Text style={styles.studioTitleText}>Match Broadcast Studio</Text>
            </View>

            {isStreaming ? (
              <View style={styles.badgeLiveNow}>
                <Text style={styles.badgeLiveNowText}>🔴 LIVE {formatDuration(streamDuration)}</Text>
              </View>
            ) : (
              <View style={styles.badgeReadyNow}>
                <Text style={styles.badgeReadyNowText}>READY TO STREAM</Text>
              </View>
            )}
          </View>

          {/* Streaming As Row */}
          <View style={styles.streamingAsBox}>
            <Text style={styles.streamingAsLabel}>STREAMING AS</Text>
            <Text style={styles.streamingAsName}>{playerName} ({playerRole})</Text>
          </View>

          {/* 3-Column Team Identity Bar */}
          <View style={styles.teamIdentityGrid}>
            <View style={styles.teamGridCol}>
              <View style={styles.teamIconBox}>
                <Text style={styles.teamIconText}>
                  {(selectedMatch?.teamTag || selectedMatch?.teamName || 'T1').slice(0, 3).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.teamRoleLabel}>YOUR TEAM</Text>
              <Text style={styles.teamGridName} numberOfLines={2}>{selectedMatch?.teamName}</Text>
            </View>

            <View style={styles.teamGridCenter}>
              <Text style={styles.teamGridVs}>VS</Text>
              <View style={styles.tablePill}>
                <Text style={styles.tablePillText}>Table #{selectedMatch?.tableNumber}</Text>
              </View>
            </View>

            <View style={styles.teamGridCol}>
              <View style={[styles.teamIconBox, { backgroundColor: '#2563eb', borderColor: '#60a5fa' }]}>
                <Text style={styles.teamIconText}>
                  {(selectedMatch?.opponentTag || selectedMatch?.opponentName || 'T2').slice(0, 3).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.teamRoleLabel}>OPPONENT</Text>
              <Text style={styles.teamGridName} numberOfLines={2}>{selectedMatch?.opponentName}</Text>
            </View>
          </View>

          {/* 3. CAMERA VIEWPORT WITH FULL OVERLAYS */}
          <View style={styles.cameraViewportContainer}>
            {/* Native Camera View */}
            {camPermission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing={facing}
                enableTorch={torch}
                mute={isMuted} // Muted by default
              />
            ) : (
              <View style={styles.permissionFallback}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📷</Text>
                <Text style={styles.permissionHeading}>Camera Access Needed</Text>
                <Text style={styles.permissionSub}>Grant camera permission to activate live feed</Text>
                <TouchableOpacity
                  style={styles.grantBtn}
                  onPress={() => requestCamPermission && requestCamPermission()}
                >
                  <Text style={styles.grantBtnText}>ENABLE CAMERA</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* OVERLAY 1: Top Tournament Header & Player Scoreboard */}
            <View style={styles.cameraTopHUD} pointerEvents="none">
              <View style={styles.hudTopBar}>
                <Text style={styles.hudEditionTitle} numberOfLines={1}>
                  CBOT WORLD • {selectedMatch?.editionTitle}
                </Text>
                <Text style={styles.hudClockText}>{currentTimeStr}</Text>
              </View>

              {/* Scoreboard Pill Banner */}
              <View style={styles.hudScoreboardBanner}>
                <View style={styles.hudTeamBlockLeft}>
                  <Text style={styles.hudTeamTitle} numberOfLines={1}>
                    Player: {playerName}
                  </Text>
                  <Text style={styles.hudQueenCount}>⚡ {totalSlams} Slams • {boards.length} Boards</Text>
                </View>
                <View style={styles.hudScoreBadge}>
                  <Text style={styles.hudScoreLabel}>PTS</Text>
                  <Text style={styles.hudScoreNum}>{totalScore}</Text>
                </View>
              </View>
            </View>

            {/* OVERLAY 2: Carrom Board Center Alignment Target */}
            <View style={styles.carromBoardTarget} pointerEvents="none">
              <View style={[styles.targetPocket, styles.pocketTL]} />
              <View style={[styles.targetPocket, styles.pocketTR]} />
              <View style={[styles.targetPocket, styles.pocketBL]} />
              <View style={[styles.targetPocket, styles.pocketBR]} />
              <View style={styles.targetCenterRing}>
                <View style={styles.targetCrossH} />
                <View style={styles.targetCrossV} />
              </View>
              <Text style={styles.targetLabel}>ALIGN CARROM BOARD IN FRAME</Text>
            </View>

            {/* OVERLAY 3: Broadcaster Lower-Third Info */}
            <View style={styles.cameraBottomHUD} pointerEvents="none">
              <View style={styles.hudBroadcasterRow}>
                <Text style={styles.hudVerifiedBadge}>✓ VERIFIED CBOT BROADCAST</Text>
                <Text style={styles.hudBroadcasterName}>{selectedMatch?.teamName} vs {selectedMatch?.opponentName}</Text>
              </View>
            </View>

            {/* OVERLAY 4: In-Camera Quick Controls (Flip Cam, Mute, Flashlight) */}
            <View style={styles.cameraControlsFloating}>
              <TouchableOpacity
                style={styles.floatingToolBtn}
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              >
                <Text style={styles.floatingToolText}>🔄 Flip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.floatingToolBtn, !isMuted && styles.floatingToolActive]}
                onPress={() => setIsMuted((m) => !m)}
              >
                <Text style={styles.floatingToolText}>
                  {isMuted ? '🔇 Muted' : '🔊 Unmuted'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.floatingToolBtn, torch && styles.floatingToolActive]}
                onPress={() => setTorch((t) => !t)}
              >
                <Text style={styles.floatingToolText}>
                  {torch ? '💡 Light ON' : '🔦 Light'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. CAMERA POSITIONING TIP */}
          <View style={styles.cameraTipBox}>
            <Text style={styles.cameraTipText}>
              💡 Position your camera so the complete Carrom board is clearly visible in the frame.
            </Text>
          </View>

          {/* 5. PLAYER-CENTRIC BOARD-BY-BOARD SCORER */}
          <View style={styles.liveScorekeeperContainer}>
            {/* Header: Player Name + Total Points Banner */}
            <View style={styles.scorerHeaderBar}>
              <View>
                <Text style={styles.scorerPlayerLabel}>PLAYER SCORER</Text>
                <Text style={styles.scorerPlayerName}>{playerName}</Text>
              </View>
              <View style={styles.totalScorePill}>
                <Text style={styles.totalScorePillLabel}>TOTAL SCORE</Text>
                <Text style={styles.totalScorePillNum}>{totalScore} pts</Text>
              </View>
            </View>

            {/* Board Cards List */}
            {boards.map((board) => (
              <View key={board.boardNumber} style={styles.boardCardRow}>
                {/* Left: Board Label & Score Indicator */}
                <View style={styles.boardInfoCol}>
                  <Text style={styles.boardNumTitle}>Board {board.boardNumber}</Text>
                  <View style={styles.boardScorePill}>
                    <Text style={styles.boardScorePillText}>{board.score} pts</Text>
                    {board.slams > 0 && (
                      <Text style={styles.boardSlamTag}>⚡ {board.slams} Slam</Text>
                    )}
                  </View>
                </View>

                {/* Right: Board Action Buttons [-1], [+1], [Slam (+/-)] */}
                <View style={styles.boardActionsGroup}>
                  <TouchableOpacity
                    style={styles.btnMinus}
                    onPress={() => handleModifyBoardScore(board.boardNumber, -1)}
                  >
                    <Text style={styles.btnMinusText}>-1</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnAdd}
                    onPress={() => handleModifyBoardScore(board.boardNumber, 1)}
                  >
                    <Text style={styles.btnAddText}>+1</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnSlamMinus, board.slams === 0 && styles.btnDisabled]}
                    onPress={() => handleModifyBoardSlam(board.boardNumber, -1)}
                    disabled={board.slams === 0}
                  >
                    <Text style={styles.btnSlamText}>Slam -</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnSlamPlus}
                    onPress={() => handleModifyBoardSlam(board.boardNumber, 1)}
                  >
                    <Text style={styles.btnSlamPlusText}>⚡ Slam +</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Add New Board Button */}
            <TouchableOpacity
              style={styles.addBoardBtn}
              onPress={handleAddNewBoard}
              activeOpacity={0.85}
            >
              <Text style={styles.addBoardBtnText}>➕ ADD NEW BOARD (BOARD {boards.length + 1})</Text>
            </TouchableOpacity>
          </View>

          {/* 6. PRIMARY BROADCAST ACTIONS */}
          <View style={styles.broadcastActionArea}>
            {!isStreaming ? (
              <TouchableOpacity
                style={[styles.startBroadcastBtn, actionLoading && styles.btnDisabled]}
                onPress={handleStartStream}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.startBroadcastText}>▶ START LIVE STREAM</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.stopBroadcastBtn, actionLoading && styles.btnDisabled]}
                onPress={handleStopStream}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.stopBroadcastText}>⏹ END LIVE STREAM & SAVE RECORDING</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 7. SHAREABLE LINK CARD */}
        <View style={styles.shareCardContainer}>
          <View style={styles.shareCardHeader}>
            <Text style={styles.shareCardTitle}>📢 SHARE LIVE MATCH LINK</Text>
            <Text style={styles.shareCardSub}>Share with viewers and fans so they can watch live</Text>
          </View>

          <View style={styles.shareUrlBox}>
            <Text style={styles.shareUrlText} numberOfLines={1}>{getShareableUrl()}</Text>
          </View>

          <View style={styles.shareActionsRow}>
            <TouchableOpacity style={styles.shareBtnCopy} onPress={handleCopyShareLink}>
              <Text style={styles.shareBtnCopyText}>{copiedLink ? '✓ Copied' : '📋 Copy Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtnWhatsApp} onPress={handleOpenWhatsApp}>
              <Text style={styles.shareBtnWhatsAppText}>💬 Share on WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },

  // LOGIN SCREEN
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 50,
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 4,
  },
  appSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 4,
    marginTop: 4,
  },
  formContainer: {
    width: '100%',
    maxWidth: 360,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f1f5f9',
  },
  loginButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 2,
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 18,
    textAlign: 'center',
  },

  // MATCHES HUB
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f59e0b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerRefreshBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  headerRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  matchList: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  matchCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editionBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchEdition: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stagePill: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stagePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  teamAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  teamNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  vsCenter: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 4,
  },
  tableBadge: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tableBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
  },
  goLiveRow: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    marginTop: 12,
    paddingTop: 10,
    alignItems: 'center',
  },
  goLiveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  logoutButton: {
    margin: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
  },
  logoutText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 2,
  },

  // LIVE STUDIO SCREEN
  liveScroll: {
    flex: 1,
    backgroundColor: '#020617',
  },
  websiteTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  navBackBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navBackText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  navShareBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navShareText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f59e0b',
  },
  navEditionBadge: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: 110,
  },
  navEditionText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
  },

  // MAIN STUDIO CARD
  studioCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#0b1120',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  studioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 12,
    marginBottom: 12,
  },
  officialTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#f59e0b',
  },
  liveDotSmallPulsing: {
    backgroundColor: '#ef4444',
  },
  officialTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  studioTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  badgeLiveNow: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeLiveNowText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  badgeReadyNow: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeReadyNowText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },

  // Streaming As
  streamingAsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  streamingAsLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 1,
  },
  streamingAsName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },

  // Team Identity Grid
  teamIdentityGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  teamGridCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  teamIconText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  teamRoleLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 2,
  },
  teamGridName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  teamGridCenter: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  teamGridVs: {
    fontSize: 14,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 2,
  },
  tablePill: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tablePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },

  // CAMERA VIEWPORT & OVERLAYS
  cameraViewportContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  permissionFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050b14',
    padding: 20,
  },
  permissionHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  permissionSub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 14,
  },
  grantBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  grantBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1,
  },

  // Overlay: Top HUD
  cameraTopHUD: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    zIndex: 20,
  },
  hudTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  hudEditionTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
    flex: 1,
  },
  hudClockText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  hudScoreboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hudTeamBlockLeft: {
    flex: 1,
  },
  hudTeamTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  hudQueenCount: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
    marginTop: 1,
  },
  hudScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hudScoreLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    marginRight: 4,
  },
  hudScoreNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f59e0b',
  },

  // Overlay: Carrom Board Target
  carromBoardTarget: {
    position: 'absolute',
    top: 55,
    bottom: 35,
    left: 20,
    right: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  targetPocket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  pocketTL: { top: 4, left: 4 },
  pocketTR: { top: 4, right: 4 },
  pocketBL: { bottom: 4, left: 4 },
  pocketBR: { bottom: 4, right: 4 },
  targetCenterRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  targetCrossH: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: '#f59e0b',
  },
  targetCrossV: {
    position: 'absolute',
    width: 2,
    height: 16,
    backgroundColor: '#f59e0b',
  },
  targetLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Overlay: Bottom HUD
  cameraBottomHUD: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    zIndex: 20,
  },
  hudBroadcasterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hudVerifiedBadge: {
    fontSize: 8,
    fontWeight: '900',
    color: '#10b981',
  },
  hudBroadcasterName: {
    fontSize: 8,
    fontWeight: '800',
    color: '#f1f5f9',
  },

  // Floating In-Camera Tools
  cameraControlsFloating: {
    position: 'absolute',
    right: 8,
    bottom: 30,
    flexDirection: 'column',
    gap: 6,
    zIndex: 30,
  },
  floatingToolBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  floatingToolActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
  },
  floatingToolText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },

  // Positioning Tip
  cameraTipBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  cameraTipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fcd34d',
    textAlign: 'center',
  },

  // BOARD-BY-BOARD SCORER (PLAYER ONLY)
  liveScorekeeperContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  scorerHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
    marginBottom: 10,
  },
  scorerPlayerLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  scorerPlayerName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f59e0b',
  },
  totalScorePill: {
    alignItems: 'flex-end',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  totalScorePillLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  totalScorePillNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f59e0b',
  },

  // Board Row
  boardCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  boardInfoCol: {
    width: 80,
  },
  boardNumTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  boardScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  boardScorePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f59e0b',
  },
  boardSlamTag: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },

  // Board Action Buttons
  boardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnMinus: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnMinusText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
  },
  btnAdd: {
    backgroundColor: '#065f46',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnAddText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#34d399',
  },
  btnSlamMinus: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnSlamText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  btnSlamPlus: {
    backgroundColor: '#78350f',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnSlamPlusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fde68a',
  },

  // Add New Board Button
  addBoardBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addBoardBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },

  // Primary Actions
  broadcastActionArea: {
    alignItems: 'center',
    paddingTop: 4,
  },
  startBroadcastBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  startBroadcastText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1.5,
  },
  stopBroadcastBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  stopBroadcastText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // SHARE CARD
  shareCardContainer: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 14,
  },
  shareCardHeader: {
    marginBottom: 8,
  },
  shareCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  shareCardSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  shareUrlBox: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  shareUrlText: {
    fontSize: 11,
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  shareActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shareBtnCopy: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareBtnCopyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  shareBtnWhatsApp: {
    flex: 1.2,
    backgroundColor: '#15803d',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareBtnWhatsAppText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
});
