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
  Image,
  Linking,
} from 'react-native';
import {
  loginPlayer,
  getPlayerMatches,
  getPlayerCombis,
  MatchDetails,
} from './services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Screen = 'login' | 'matches' | 'combis' | 'live';

type CombiDay = NonNullable<Awaited<ReturnType<typeof getPlayerCombis>>['days']>[number];

export default function App() {
  // Navigation & Auth State
  const [screen, setScreen] = useState<Screen>('login');
  const [token, setToken] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [playerRole, setPlayerRole] = useState<string>('PLAYER');
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);
  const [myTeam, setMyTeam] = useState<{
    id: string;
    name: string;
    tag: string;
    logo?: string | null;
    captainName?: string | null;
  } | null>(null);
  const [isSpocCombiTeam, setIsSpocCombiTeam] = useState(false);
  const [combiDays, setCombiDays] = useState<CombiDay[]>([]);
  const [selectedCombiDay, setSelectedCombiDay] = useState<number | null>(null);
  const [combisLoading, setCombisLoading] = useState(false);

  // Login State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCombis = async (authToken: string) => {
    setCombisLoading(true);
    try {
      const res = await getPlayerCombis(authToken);
      if (res.success) {
        if (res.team) setMyTeam(res.team);
        setIsSpocCombiTeam(Boolean((res as any).isSpocTeam));
        const days = res.days || [];
        setCombiDays(days);
        setSelectedCombiDay((prev) => {
          if (prev && days.some((d) => d.dayNumber === prev)) return prev;
          const revealed = [...days].reverse().find((d) => d.revealed);
          return revealed?.dayNumber || days[0]?.dayNumber || null;
        });
      }
    } finally {
      setCombisLoading(false);
    }
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
        if (res.team) setMyTeam(res.team);

        const matchRes = await getPlayerMatches(res.token);
        if (matchRes.success && matchRes.matches) {
          setMatches(matchRes.matches);
          if (matchRes.team) setMyTeam((prev) => ({ ...(prev || matchRes.team!), ...matchRes.team! }));
        }
        await loadCombis(res.token);
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
    if (!match.canGoLive) {
      Alert.alert(
        match.status === 'COMPLETED' ? `${match.label} closed` : `${match.label} not open yet`,
        match.timeRange || 'Follow the official 8pm–8pm match schedule.'
      );
      return;
    }
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

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]} onPress={() => setScreen('matches')}>
            <Text style={[styles.tabText, styles.tabTextActive]}>MATCHES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setScreen('combis')}>
            <Text style={styles.tabText}>COMBIS</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.matchList} showsVerticalScrollIndicator={false}>
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyText}>No matches on the schedule for your team yet.</Text>
              <Text style={styles.emptySubtext}>
                Your fixtures appear here from the organizer match schedule after you log in.
              </Text>
            </View>
          ) : (
            matches.map((match) => {
              const isLive = match.status === 'LIVE';
              const isDone = match.status === 'COMPLETED';
              return (
              <TouchableOpacity
                key={match.matchId || match.label}
                style={[
                  styles.matchCard,
                  isLive && styles.matchCardLive,
                  isDone && styles.matchCardDone,
                ]}
                onPress={() => handleSelectMatch(match)}
                activeOpacity={isLive ? 0.85 : 1}
              >
                <View style={styles.matchCardHeader}>
                  <View style={styles.dayCol}>
                    <Text style={styles.dayLabel}>DAY</Text>
                    <Text style={[styles.dayNum, isLive && { color: '#ef4444' }, isDone && { color: '#34d399' }]}>
                      {match.dayNumber}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchEdition}>{match.title || match.label}</Text>
                    <Text style={styles.timeRangeText}>{match.timeRange}</Text>
                  </View>
                  <View style={[styles.stagePill, isLive && styles.stagePillLive, isDone && styles.stagePillDone]}>
                    <Text style={[styles.stagePillText, isLive && { color: '#ef4444' }, isDone && { color: '#34d399' }]}>
                      {match.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.teamsRow}>
                  <View style={styles.teamCol}>
                    {match.teamLogo ? (
                      <Image source={{ uri: match.teamLogo }} style={styles.teamLogo} />
                    ) : (
                      <View style={styles.teamAvatar}>
                        <Text style={styles.teamAvatarText}>
                          {(match.teamTag || match.teamName || 'T1').slice(0, 3).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.teamNameText} numberOfLines={1}>
                      {match.teamName}
                    </Text>
                    <Text style={styles.youOpp}>YOU</Text>
                  </View>

                  <View style={styles.vsCenter}>
                    <Text style={styles.vsText}>VS</Text>
                    <View style={styles.tableBadge}>
                      <Text style={styles.tableBadgeText}>{match.label}</Text>
                    </View>
                  </View>

                  <View style={styles.teamCol}>
                    {match.opponentLogo ? (
                      <Image source={{ uri: match.opponentLogo }} style={styles.teamLogo} />
                    ) : (
                      <View style={[styles.teamAvatar, { backgroundColor: '#3b82f6' }]}>
                        <Text style={styles.teamAvatarText}>
                          {(match.opponentTag || match.opponentName || 'T2').slice(0, 3).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.teamNameText} numberOfLines={1}>
                      {match.opponentName}
                    </Text>
                    <Text style={styles.youOpp}>OPP</Text>
                  </View>
                </View>

                <View style={styles.goLiveRow}>
                  <Text style={[styles.goLiveText, !isLive && { color: '#64748b' }]}>
                    {isLive ? '🔴 GO LIVE ON YOUTUBE →' : isDone ? '🔒 CLOSED' : `🔒 OPENS ${match.label}`}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            setScreen('login');
            setToken('');
            setMatches([]);
            setCombiDays([]);
            setMyTeam(null);
          }}
        >
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ==========================================
  // SCREEN 2b: DAILY COMBIS (YOU vs OPPONENT)
  // ==========================================
  if (screen === 'combis') {
    const activeDay = combiDays.find((d) => d.dayNumber === selectedCombiDay) || combiDays[0] || null;
    const opp = activeDay?.opponent;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{isSpocCombiTeam ? '✨ SPOC COMBIS' : '⚔️ DAILY COMBIS'}</Text>
            <Text style={styles.headerSubtitle}>
              {(myTeam?.name || 'Your team') + (isSpocCombiTeam ? ' · Spoc exhibition vs opponent' : " vs that day's opponent")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerRefreshBtn}
            onPress={() => token && loadCombis(token)}
          >
            <Text style={styles.headerRefreshText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setScreen('matches')}>
            <Text style={styles.tabText}>MATCHES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]} onPress={() => setScreen('combis')}>
            <Text style={[styles.tabText, styles.tabTextActive]}>COMBIS</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayChipsScroll}
          contentContainerStyle={styles.dayChipsContent}
        >
          {combiDays.map((d) => {
            const selected = d.dayNumber === (activeDay?.dayNumber || selectedCombiDay);
            return (
              <TouchableOpacity
                key={d.dayNumber}
                style={[styles.dayChip, selected && styles.dayChipActive]}
                onPress={() => setSelectedCombiDay(d.dayNumber)}
              >
                <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>
                  Day {d.dayNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView style={styles.matchList} showsVerticalScrollIndicator={false}>
          {combisLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#f59e0b" />
              <Text style={styles.emptySubtext}>Loading combis…</Text>
            </View>
          ) : !activeDay ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No combis available yet.</Text>
              <Text style={styles.emptySubtext}>
                Combis publish after 9:30 PM IST on each match day.
              </Text>
            </View>
          ) : (
            <View style={[styles.combiCard, isSpocCombiTeam && { borderColor: '#8b5cf688' }]}>
              {isSpocCombiTeam ? (
                <View style={styles.spocCombiBadgeRow}>
                  <Text style={styles.spocCombiBadge}>Spoc Exhibition Match</Text>
                </View>
              ) : null}
              <View style={styles.combiHeader}>
                <View style={styles.combiTeamCol}>
                  {myTeam?.logo ? (
                    <Image source={{ uri: myTeam.logo }} style={styles.combiLogo} />
                  ) : (
                    <View style={styles.combiLogoFallback}>
                      <Text style={styles.combiLogoText}>{(myTeam?.tag || 'YOU').slice(0, 3)}</Text>
                    </View>
                  )}
                  <Text style={styles.combiTeamName} numberOfLines={2}>
                    {myTeam?.name || 'Your Team'}
                  </Text>
                  <Text style={styles.combiTeamMeta}>
                    ({myTeam?.tag || 'YOU'})
                  </Text>
                  {myTeam?.captainName ? (
                    <Text style={styles.combiCapt}>Capt: {myTeam.captainName}</Text>
                  ) : null}
                </View>

                <View style={styles.combiVs}>
                  <View style={styles.combiVsBadge}>
                    <Text style={styles.combiVsText}>VS</Text>
                  </View>
                  <Text style={styles.combiDayLabel}>Day {activeDay.dayNumber}</Text>
                </View>

                <View style={styles.combiTeamCol}>
                  {opp?.logo ? (
                    <Image source={{ uri: opp.logo }} style={styles.combiLogo} />
                  ) : (
                    <View style={[styles.combiLogoFallback, { backgroundColor: '#3b82f6' }]}>
                      <Text style={styles.combiLogoText}>{(opp?.tag || 'OPP').slice(0, 3)}</Text>
                    </View>
                  )}
                  <Text style={[styles.combiTeamName, { color: '#fb923c' }]} numberOfLines={2}>
                    {opp?.name || 'TBD'}
                  </Text>
                  <Text style={styles.combiTeamMeta}>
                    ({opp?.tag || 'OPP'})
                  </Text>
                  {opp?.captainName ? (
                    <Text style={styles.combiCapt}>Capt: {opp.captainName}</Text>
                  ) : null}
                </View>
              </View>

              {!opp ? (
                <Text style={styles.combiLockedNote}>
                  No opponent fixture found for Day {activeDay.dayNumber} yet.
                </Text>
              ) : null}

              <View style={styles.combiEvents}>
                {(activeDay.events || []).map((evt) => {
                  const fmt = (evt.format || evt.name || '').toUpperCase();
                  const isDoubles = fmt.includes('DOUBLE');
                  const isTriples = fmt.includes('TRIPLE');
                  return (
                    <View key={evt.index} style={styles.combiEventRow}>
                      <Text style={styles.combiPlayersLeft} numberOfLines={3}>
                        {evt.myPlayers}
                      </Text>
                      <View
                        style={[
                          styles.combiEventBadge,
                          isDoubles && styles.combiEventDoubles,
                          isTriples && styles.combiEventTriples,
                        ]}
                      >
                        <Text
                          style={[
                            styles.combiEventBadgeText,
                            isTriples && { color: '#fff' },
                          ]}
                        >
                          {evt.name}
                        </Text>
                      </View>
                      <Text style={styles.combiPlayersRight} numberOfLines={3}>
                        {evt.opponentPlayers}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            setScreen('login');
            setToken('');
            setMatches([]);
            setCombiDays([]);
            setMyTeam(null);
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
  const youtubeLiveUrl = `cbot://live?name=${encodeURIComponent(playerName)}&day=${encodeURIComponent(selectedMatch?.label || 'Day')}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.liveNavHeader}>
        <TouchableOpacity
          style={styles.exitStudioBtn}
          onPress={() => setScreen('matches')}
          activeOpacity={0.8}
        >
          <Text style={styles.exitStudioText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.liveNavCenter}>
          <Text style={styles.liveNavTitle} numberOfLines={1}>
            {selectedMatch?.label} · {selectedMatch?.teamName} vs {selectedMatch?.opponentName}
          </Text>
        </View>

        <View style={styles.livePill}>
          <Text style={styles.livePillText}>🔴 LIVE DAY</Text>
        </View>
      </View>

      <View style={styles.webviewLoading}>
        <Text style={styles.emptyIcon}>📺</Text>
        <Text style={styles.emptyText}>Go live as {playerName}</Text>
        <Text style={styles.emptySubtext}>
          {selectedMatch?.label} · {selectedMatch?.timeRange}
          {'\n'}
          Overlay will show your name and day. Video goes to the CBOT YouTube channel — not the website database.
        </Text>
        <TouchableOpacity
          style={[styles.loginButton, { marginTop: 24, width: 280 }]}
          onPress={() => Linking.openURL(youtubeLiveUrl).catch(() => {
            Alert.alert('Open Cbot Live', 'Install the Cbot YouTube live app (com.cbotworld) to broadcast.');
          })}
        >
          <Text style={styles.loginButtonText}>OPEN YOUTUBE LIVE</Text>
        </TouchableOpacity>
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
  matchCardLive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  matchCardDone: {
    borderColor: '#14532d',
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  dayCol: {
    width: 52,
    alignItems: 'center',
    marginRight: 10,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  dayNum: {
    fontSize: 26,
    fontWeight: '900',
    color: '#f59e0b',
    lineHeight: 30,
  },
  timeRangeText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#020617',
  },
  youOpp: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 1,
  },
  stagePillLive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  stagePillDone: {
    backgroundColor: 'rgba(16,185,129,0.15)',
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

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#f59e0b',
  },
  dayChipsScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  dayChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  dayChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  dayChipTextActive: {
    color: '#0f172a',
  },
  combiCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f59e0b55',
    overflow: 'hidden',
    marginBottom: 16,
  },
  combiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#020617',
  },
  combiTeamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  combiLogo: {
    width: 64,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: '#f59e0b66',
  },
  combiLogoFallback: {
    width: 64,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  combiLogoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  combiTeamName: {
    color: '#facc15',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
  },
  combiTeamMeta: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  combiCapt: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  combiVs: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  combiVsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  combiVsText: {
    color: '#f59e0b',
    fontWeight: '900',
    fontSize: 11,
  },
  combiDayLabel: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  combiLockedNote: {
    textAlign: 'center',
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  combiEvents: {
    padding: 10,
    gap: 6,
  },
  combiEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  combiPlayersLeft: {
    flex: 1,
    textAlign: 'right',
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
    paddingRight: 6,
  },
  combiPlayersRight: {
    flex: 1,
    textAlign: 'left',
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
    paddingLeft: 6,
  },
  combiEventBadge: {
    minWidth: 72,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#facc15',
  },
  combiEventDoubles: {
    backgroundColor: '#2dd4bf',
  },
  combiEventTriples: {
    backgroundColor: '#a855f7',
  },
  combiEventBadgeText: {
    color: '#0f172a',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  spocCombiBadgeRow: {
    alignItems: 'center',
    paddingTop: 10,
  },
  spocCombiBadge: {
    color: '#c4b5fd',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1,
    borderColor: '#8b5cf666',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
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
