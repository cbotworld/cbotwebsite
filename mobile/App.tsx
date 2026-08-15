import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
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
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  loginPlayer,
  getPlayerMatches,
  createStreamSession,
  stopStreamSession,
  MatchDetails,
  StreamSession,
} from './services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Screens
type Screen = 'login' | 'matches' | 'live';

export default function App() {
  // Navigation & User State
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [playerRole, setPlayerRole] = useState<string>('PLAYER');
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);

  // Login Form State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Live Stream & Score State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<StreamSession | null>(null);
  const [streamDuration, setStreamDuration] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);

  // Live in-match scores
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [queen1, setQueen1] = useState(0);
  const [queen2, setQueen2] = useState(0);

  // Camera Permissions Hook
  const [permission, requestPermission] = useCameraPermissions();

  // Auto-request camera permissions on launch or when entering live screen
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, screen]);

  // Sync match scores when a match is selected
  useEffect(() => {
    if (selectedMatch) {
      setScore1(selectedMatch.score1 || 0);
      setScore2(selectedMatch.score2 || 0);
      setQueen1(selectedMatch.queenStrikes1 || 0);
      setQueen2(selectedMatch.queenStrikes2 || 0);
    }
  }, [selectedMatch]);

  // Timer for live duration
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    if (!permission?.granted) {
      requestPermission();
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
        Alert.alert('🔴 Live Stream Active', 'Match broadcast is now streaming live to YouTube!');
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
        Alert.alert('Match Completed', 'Live broadcast ended and match archived successfully!');
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

  // SCREEN 1: LOGIN SCREEN
  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loginContainer}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🏆</Text>
            <Text style={styles.appTitle}>CBOT</Text>
            <Text style={styles.appSubtitle}>LIVE STREAM STUDIO</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formLabel}>USERNAME OR EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. player1 or player@cbotworld.com"
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

  // SCREEN 2: MATCHES HUB
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
                {/* Card Top Row: Edition & Stage Badges */}
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

                {/* Team vs Team Matchup */}
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

                {/* Card Footer Call to Action */}
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

  // SCREEN 3: LIVE STREAM STUDIO WITH FULL OVERLAYS & CAMERA
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.liveContainer}>
        {/* Top Header Navigation Bar */}
        <View style={styles.liveHeader}>
          <TouchableOpacity
            onPress={() => {
              if (isStreaming) {
                Alert.alert('Live Stream Active', 'Please end the match before leaving.');
              } else {
                setScreen('matches');
              }
            }}
            style={styles.backButtonTouchable}
          >
            <Text style={styles.backButton}>← Exit Studio</Text>
          </TouchableOpacity>

          <View style={styles.liveHeaderCenter}>
            <Text style={styles.liveEditionTag} numberOfLines={1}>
              {selectedMatch?.editionTitle} • {selectedMatch?.stage || 'LEAGUE'} • TABLE #{selectedMatch?.tableNumber}
            </Text>
          </View>

          {isStreaming ? (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE {formatDuration(streamDuration)}</Text>
            </View>
          ) : (
            <View style={styles.readyIndicator}>
              <Text style={styles.readyBadgeText}>STUDIO READY</Text>
            </View>
          )}
        </View>

        {/* Camera Viewport with Scoreboard Overlays */}
        <View style={styles.cameraContainer}>
          {/* 1. Live Camera Feed */}
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing={facing}
              enableTorch={torch}
            />
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionIcon}>📷</Text>
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionText}>
                Enable camera to record and stream your Carrom board match
              </Text>
              <TouchableOpacity
                style={styles.permissionBtn}
                onPress={requestPermission}
              >
                <Text style={styles.permissionBtnText}>GRANT CAMERA PERMISSION</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 2. Top Scoreboard HUD Overlay */}
          <View style={styles.topScoreboardHUD} pointerEvents="box-none">
            <View style={styles.scoreboardBanner}>
              {/* Home Team */}
              <View style={styles.scoreboardTeamLeft}>
                <View style={styles.hudAvatar}>
                  <Text style={styles.hudAvatarText}>
                    {(selectedMatch?.teamTag || selectedMatch?.teamName || 'T1').slice(0, 3).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.hudTeamInfo}>
                  <Text style={styles.hudTeamName} numberOfLines={1}>
                    {selectedMatch?.teamName}
                  </Text>
                  <Text style={styles.hudQueenText}>👑 {queen1} Queens</Text>
                </View>
                <Text style={styles.hudScoreDigit}>{score1}</Text>
              </View>

              {/* Center Match Divider */}
              <View style={styles.scoreboardCenterDivider}>
                <Text style={styles.hudVsText}>VS</Text>
                <Text style={styles.hudTableText}>T#{selectedMatch?.tableNumber}</Text>
              </View>

              {/* Away Team */}
              <View style={styles.scoreboardTeamRight}>
                <Text style={[styles.hudScoreDigit, { color: '#38bdf8' }]}>{score2}</Text>
                <View style={[styles.hudTeamInfo, { alignItems: 'flex-end' }]}>
                  <Text style={styles.hudTeamName} numberOfLines={1}>
                    {selectedMatch?.opponentName}
                  </Text>
                  <Text style={styles.hudQueenText}>👑 {queen2} Queens</Text>
                </View>
                <View style={[styles.hudAvatar, { backgroundColor: '#3b82f6' }]}>
                  <Text style={styles.hudAvatarText}>
                    {(selectedMatch?.opponentTag || selectedMatch?.opponentName || 'T2').slice(0, 3).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3. Center Carrom Board Aiming HUD */}
          <View style={styles.boardAimGuide} pointerEvents="none">
            {/* 4 Corner Pockets */}
            <View style={[styles.pocketMarker, styles.pocketTL]} />
            <View style={[styles.pocketMarker, styles.pocketTR]} />
            <View style={[styles.pocketMarker, styles.pocketBL]} />
            <View style={[styles.pocketMarker, styles.pocketBR]} />

            {/* Center Circle Target */}
            <View style={styles.centerAimRing}>
              <View style={styles.centerAimCrossV} />
              <View style={styles.centerAimCrossH} />
            </View>
            <Text style={styles.boardAimText}>ALIGN CARROM BOARD IN FRAME</Text>
          </View>

          {/* 4. Lower-Third Broadcaster & YouTube Card */}
          <View style={styles.broadcasterCard} pointerEvents="none">
            <View style={styles.broadcasterRow}>
              <Text style={styles.broadcasterIcon}>🎙️</Text>
              <View>
                <Text style={styles.broadcasterName}>
                  Broadcaster: {playerName} ({playerRole})
                </Text>
                <Text style={styles.broadcasterTourney}>
                  CBOT World Official Stream • Table #{selectedMatch?.tableNumber}
                </Text>
              </View>
            </View>
            {streamData?.youtubeUrl && (
              <Text style={styles.ytBroadcastStatus}>
                🔴 LIVE ON YOUTUBE: {streamData.youtubeUrl}
              </Text>
            )}
          </View>
        </View>

        {/* In-Match Live Score Adjuster Bar */}
        <View style={styles.scoreAdjusterBar}>
          <View style={styles.scoreAdjustGroup}>
            <Text style={styles.scoreAdjustTeamLabel} numberOfLines={1}>
              {selectedMatch?.teamName}
            </Text>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => setScore1((s) => Math.max(0, s - 1))}
              >
                <Text style={styles.adjustBtnText}>-1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustBtn, styles.adjustBtnAdd]}
                onPress={() => setScore1((s) => s + 1)}
              >
                <Text style={styles.adjustBtnTextAdd}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.queenBtn}
                onPress={() => {
                  setQueen1((q) => q + 1);
                  setScore1((s) => s + 3);
                }}
              >
                <Text style={styles.queenBtnText}>👑 +3</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.scoreAdjustGroup}>
            <Text style={[styles.scoreAdjustTeamLabel, { textAlign: 'right' }]} numberOfLines={1}>
              {selectedMatch?.opponentName}
            </Text>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.queenBtn}
                onPress={() => {
                  setQueen2((q) => q + 1);
                  setScore2((s) => s + 3);
                }}
              >
                <Text style={styles.queenBtnText}>👑 +3</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => setScore2((s) => Math.max(0, s - 1))}
              >
                <Text style={styles.adjustBtnText}>-1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustBtn, styles.adjustBtnAdd]}
                onPress={() => setScore2((s) => s + 1)}
              >
                <Text style={styles.adjustBtnTextAdd}>+1</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom Control Bar with Camera Tools & Stream Launch */}
        <View style={styles.liveControls}>
          {/* Quick Camera Tools */}
          <View style={styles.cameraToolsRow}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <Text style={styles.toolBtnText}>🔄 Flip Cam</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, torch && styles.toolBtnActive]}
              onPress={() => setTorch((t) => !t)}
            >
              <Text style={styles.toolBtnText}>{torch ? '💡 Torch ON' : '🔦 Flashlight'}</Text>
            </TouchableOpacity>
          </View>

          {/* Start / Stop Stream Action */}
          {!isStreaming ? (
            <TouchableOpacity
              style={[styles.startButton, actionLoading && styles.loginButtonDisabled]}
              onPress={handleStartStream}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.startButtonText}>▶ START LIVE STREAM TO YOUTUBE</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.stopButton, actionLoading && styles.loginButtonDisabled]}
              onPress={handleStopStream}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.stopButtonText}>⏹ END MATCH & ARCHIVE BROADCAST</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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

  // MATCHES LIST SCREEN
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
    letterSpacing: 1,
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
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
    letterSpacing: 1,
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
    backgroundColor: '#0f172a',
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
    borderTopColor: '#334155',
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

  // LIVE STREAM STUDIO SCREEN
  liveContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButtonTouchable: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backButton: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  liveHeaderCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  liveEditionTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 5,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 1,
  },
  readyIndicator: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readyBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },

  // CAMERA & OVERLAY AREA
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#050b14',
    overflow: 'hidden',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  permissionText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1,
  },

  // 1. TOP SCOREBOARD HUD
  topScoreboardHUD: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  scoreboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  scoreboardTeamLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreboardTeamRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hudAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginLeft: 6,
  },
  hudAvatarText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  hudTeamInfo: {
    flex: 1,
  },
  hudTeamName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f1f5f9',
  },
  hudQueenText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f59e0b',
  },
  hudScoreDigit: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f59e0b',
    paddingHorizontal: 8,
  },
  scoreboardCenterDivider: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  hudVsText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
  },
  hudTableText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },

  // 2. CENTER CARROM BOARD AIMING GUIDE
  boardAimGuide: {
    position: 'absolute',
    top: 65,
    bottom: 65,
    left: 20,
    right: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 12,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pocketMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  pocketTL: { top: 6, left: 6 },
  pocketTR: { top: 6, right: 6 },
  pocketBL: { bottom: 6, left: 6 },
  pocketBR: { bottom: 6, right: 6 },
  centerAimRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  centerAimCrossV: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: '#f59e0b',
  },
  centerAimCrossH: {
    position: 'absolute',
    height: 2,
    width: 20,
    backgroundColor: '#f59e0b',
  },
  boardAimText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // 3. LOWER-THIRD BROADCASTER CARD
  broadcasterCard: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 20,
  },
  broadcasterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  broadcasterIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  broadcasterName: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f1f5f9',
  },
  broadcasterTourney: {
    fontSize: 8,
    color: '#94a3b8',
  },
  ytBroadcastStatus: {
    fontSize: 8,
    fontWeight: '800',
    color: '#38bdf8',
    marginTop: 2,
  },

  // IN-MATCH SCORE ADJUSTER BAR
  scoreAdjusterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0b1120',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scoreAdjustGroup: {
    flex: 1,
  },
  scoreAdjustTeamLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  adjustBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adjustBtnAdd: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  adjustBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  adjustBtnTextAdd: {
    fontSize: 11,
    fontWeight: '900',
    color: '#34d399',
  },
  queenBtn: {
    backgroundColor: '#78350f',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  queenBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fbbf24',
  },

  // BOTTOM CONTROLS
  liveControls: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cameraToolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  toolBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toolBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
  },
  toolBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  startButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1.5,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
});
