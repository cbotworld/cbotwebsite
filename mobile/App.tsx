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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await loginPlayer(email.trim(), password);
      if (res.success && res.token) {
        setToken(res.token);
        setPlayerName(res.user?.name || 'Player');
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
            <Text style={styles.appSubtitle}>LIVE STREAM</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your CBOT email"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.loginButtonText}>SIGN IN</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>
            Use your existing CBOT Arena account to sign in
          </Text>
        </View>
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

  // Live Stream Screen - Placeholder (camera + overlay will be added with expo-camera)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.liveContainer}>
        <View style={styles.liveHeader}>
          <TouchableOpacity onPress={() => setScreen('matches')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.liveTitle}>
            {selectedMatch?.teamName} vs {selectedMatch?.opponentName}
          </Text>
        </View>

        {/* Camera view placeholder - will be replaced with expo-camera */}
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.cameraText}>📷 Camera Preview</Text>
          <Text style={styles.cameraSubtext}>
            Camera module will be loaded here with CBOT overlay
          </Text>
        </View>

        <View style={styles.liveControls}>
          <TouchableOpacity style={styles.startButton}>
            <Text style={styles.startButtonText}>▶ START LIVE STREAM</Text>
          </TouchableOpacity>
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
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    marginRight: 16,
  },
  liveTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f1f5f9',
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 32,
    color: '#475569',
  },
  cameraSubtext: {
    fontSize: 14,
    color: '#334155',
    marginTop: 8,
  },
  liveControls: {
    padding: 16,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 40,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 2,
  },
});
