import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
} from 'react-native';
import { loginPlayer, getPlayerMatches, MatchDetails } from './services/api';

// Screens
type Screen = 'login' | 'matches' | 'live';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);

  // Login state
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

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
        setPlayerName(res.user?.name || res.user?.email || username);
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
  };

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
      </SafeAreaView>
    );
  }

  if (screen === 'matches') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏆 YOUR MATCHES</Text>
          <Text style={styles.headerSubtitle}>Welcome, {playerName}</Text>
        </View>

        <ScrollView style={styles.matchList}>
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No upcoming matches found.</Text>
              <Text style={styles.emptySubtext}>
                Contact your organizer to schedule a match.
              </Text>
            </View>
          ) : (
            matches.map((match) => (
              <TouchableOpacity
                key={match.matchId}
                style={styles.matchCard}
                onPress={() => handleSelectMatch(match)}
              >
                <View style={styles.matchCardHeader}>
                  <Text style={styles.matchEdition}>{match.editionTitle}</Text>
                  <View style={[
                    styles.statusBadge,
                    match.status === 'LIVE' ? styles.statusLive :
                    match.status === 'READY' ? styles.statusReady :
                    styles.statusDefault
                  ]}>
                    <Text style={styles.statusText}>{match.status}</Text>
                  </View>
                </View>
                <Text style={styles.matchTeams}>
                  {match.teamName} vs {match.opponentName}
                </Text>
                <Text style={styles.matchMeta}>
                  Table #{match.tableNumber} • {match.scheduledTime || 'TBD'}
                </Text>
                <View style={styles.goLiveRow}>
                  <Text style={styles.goLiveText}>TAP TO GO LIVE →</Text>
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

  // Stream state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<any>(null);
  const [streamDuration, setStreamDuration] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const handleStartStream = async () => {
    if (!selectedMatch || !token) return;
    setActionLoading(true);
    try {
      const res = await createStreamSession(selectedMatch.matchId, token);
      if (res.success && res.stream) {
        setStreamData(res.stream);
        setIsStreaming(true);
        Alert.alert('Live Stream Ready', 'Stream session created! Broadcast is ready.');
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

  // Live Stream Screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.liveContainer}>
        {/* Header Bar */}
        <View style={styles.liveHeader}>
          <TouchableOpacity
            onPress={() => {
              if (isStreaming) {
                Alert.alert('Live Stream Active', 'Please end the match before leaving.');
              } else {
                setScreen('matches');
              }
            }}
          >
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.liveHeaderCenter}>
            <Text style={styles.liveTitle}>
              {selectedMatch?.teamName} vs {selectedMatch?.opponentName}
            </Text>
            <Text style={styles.liveSubtitle}>
              {selectedMatch?.editionTitle} • Table #{selectedMatch?.tableNumber}
            </Text>
          </View>
          {isStreaming && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Camera / Board View with Overlays */}
        <View style={styles.cameraPlaceholder}>
          {/* CBOT Live Scoreboard Top Overlay */}
          <View style={styles.topOverlay}>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillTeam}>{selectedMatch?.teamName}</Text>
              <Text style={styles.scorePillScore}>0</Text>
              <Text style={styles.scorePillDivider}>VS</Text>
              <Text style={styles.scorePillScore}>0</Text>
              <Text style={styles.scorePillTeam}>{selectedMatch?.opponentName}</Text>
            </View>
          </View>

          {/* Center Carrom Aim Guide */}
          <View style={styles.boardGuide}>
            <View style={styles.boardGuideCircle} />
            <Text style={styles.boardGuideText}>ALIGN CARROM BOARD HERE</Text>
          </View>

          {/* Bottom Stream Info Overlay */}
          <View style={styles.bottomOverlay}>
            <Text style={styles.watermarkText}>CBOT ARENA • OFFICIAL BROADCAST</Text>
            {streamData?.youtubeUrl && (
              <Text style={styles.ytUrlText}>YouTube: {streamData.youtubeUrl}</Text>
            )}
          </View>
        </View>

        {/* Bottom Control Action Bar */}
        <View style={styles.liveControls}>
          {!isStreaming ? (
            <TouchableOpacity
              style={[styles.startButton, actionLoading && styles.loginButtonDisabled]}
              onPress={handleStartStream}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.startButtonText}>▶ GO LIVE TO YOUTUBE</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.stopButton, actionLoading && styles.loginButtonDisabled]}
              onPress={handleStopStream}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.stopButtonText}>⏹ END MATCH & ARCHIVE</Text>
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
  // Login Screen
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 64,
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 6,
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 8,
    marginTop: 4,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#f1f5f9',
  },
  loginButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 2,
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 24,
    textAlign: 'center',
  },
  // Matches Screen
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f59e0b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  matchList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  matchCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchEdition: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusReady: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusDefault: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  matchTeams: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  matchMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  goLiveRow: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
    alignItems: 'center',
  },
  goLiveText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  logoutButton: {
    margin: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 2,
  },
  // Live Screen
  liveContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
  liveHeaderCenter: {
    alignItems: 'center',
  },
  liveTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f1f5f9',
  },
  liveSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#050b14',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    zIndex: 10,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  scorePillTeam: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f1f5f9',
    maxWidth: 100,
  },
  scorePillScore: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f59e0b',
    marginHorizontal: 8,
  },
  scorePillDivider: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    marginHorizontal: 4,
  },
  boardGuide: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  boardGuideCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  boardGuideText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 2,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 2,
  },
  ytUrlText: {
    fontSize: 10,
    color: '#38bdf8',
    marginTop: 2,
  },
  liveControls: {
    padding: 16,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 36,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 2,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 36,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
});
