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
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  loginPlayer,
  getPlayerMatches,
  MatchDetails,
} from './services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Screen = 'login' | 'matches' | 'live';

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
  // SCREEN 3: EMBEDDED LIVE BROADCAST STUDIO (OPTION A)
  // Direct In-Browser Live Video Streaming to YouTube & Supabase
  // ==========================================
  const studioUrl = `https://www.cbotworld.com/player/matches/${selectedMatch?.matchId}/live?token=${token}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {/* Top Floating Native Header */}
      <View style={styles.liveNavHeader}>
        <TouchableOpacity
          style={styles.exitStudioBtn}
          onPress={() => setScreen('matches')}
          activeOpacity={0.8}
        >
          <Text style={styles.exitStudioText}>← Exit Studio</Text>
        </TouchableOpacity>

        <View style={styles.liveNavCenter}>
          <Text style={styles.liveNavTitle} numberOfLines={1}>
            {selectedMatch?.teamName} vs {selectedMatch?.opponentName}
          </Text>
        </View>

        <View style={styles.livePill}>
          <Text style={styles.livePillText}>🔴 LIVE STUDIO</Text>
        </View>
      </View>

      {/* Full Live Streaming Studio WebView with Camera Access */}
      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: studioUrl }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          cameraAccessAndroid={true}
          microphoneAccessAndroid={true}
          originWhitelist={['*']}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Initializing CBOT Live Broadcast Studio...</Text>
            </View>
          )}
        />
      </View>
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

  // LIVE STUDIO SCREEN (OPTION A WEBVIEW)
  liveNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  exitStudioBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exitStudioText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f59e0b',
  },
  liveNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  liveNavTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  livePill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ef4444',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  webview: {
    flex: 1,
    backgroundColor: '#020617',
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 12,
  },
});
