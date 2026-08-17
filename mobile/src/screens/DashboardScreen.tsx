import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchPlayerSchedule,
  getSession,
  setSession,
  type MatchDetails,
  type MobileTeam,
} from '../api/website';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const session = getSession();
  const playerName = session?.user.name || 'Player';
  const playerRole = session?.user.role || 'PLAYER';
  const [team, setTeam] = useState<MobileTeam>(session?.team || null);
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getSession()?.token) {
      navigation.replace('Login');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchPlayerSchedule();
      setMatches(res.matches);
      setTeam(res.team);
      setWarning(res.warning || (res.matches.length === 0 ? 'No fixtures found for your team.' : null));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load schedule.';
      setWarning(message);
      Alert.alert('Schedule', message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  const onGoLive = (match: MatchDetails) => {
    if (!match.canGoLive) {
      Alert.alert(
        match.status === 'COMPLETED' ? `${match.label} closed` : `${match.label} not open yet`,
        match.timeRange || 'Follow the official 8pm to 8pm match schedule.',
      );
      return;
    }
    navigation.navigate('Live', { name: playerName, day: match.label });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>PLAYER DASHBOARD</Text>
          <Text style={styles.headerName}>{playerName}</Text>
          <Text style={styles.headerSub}>
            {team?.name || 'No team'} · {playerRole}
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#f59e0b" />
          <Text style={styles.muted}>Loading your match schedule…</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
          {warning ? <Text style={styles.warning}>{warning}</Text> : null}
          {matches.map((match) => {
            const isLive = match.status === 'LIVE';
            const isDone = match.status === 'COMPLETED';
            return (
              <View
                key={match.matchId || match.label}
                style={[styles.card, isLive && styles.cardLive, isDone && styles.cardDone]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.dayCol}>
                    <Text style={styles.dayLabel}>DAY</Text>
                    <Text style={[styles.dayNum, isLive && { color: '#ef4444' }, isDone && { color: '#34d399' }]}>
                      {match.dayNumber}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{match.title || match.label}</Text>
                    <Text style={styles.time}>{match.timeRange}</Text>
                  </View>
                  <View style={[styles.pill, isLive && styles.pillLive, isDone && styles.pillDone]}>
                    <Text style={[styles.pillText, isLive && { color: '#ef4444' }, isDone && { color: '#34d399' }]}>
                      {match.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.teams}>
                  <View style={styles.teamCol}>
                    {match.teamLogo ? (
                      <Image source={{ uri: match.teamLogo }} style={styles.logo} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(match.teamTag || 'YOU').slice(0, 3)}</Text>
                      </View>
                    )}
                    <Text style={styles.teamName} numberOfLines={2}>{match.teamName}</Text>
                    <Text style={styles.meta}>YOU</Text>
                  </View>
                  <View style={styles.vsCol}>
                    <Text style={styles.vs}>VS</Text>
                    <Text style={styles.meta}>{match.label}</Text>
                  </View>
                  <View style={styles.teamCol}>
                    {match.opponentLogo ? (
                      <Image source={{ uri: match.opponentLogo }} style={styles.logo} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: '#3b82f6' }]}>
                        <Text style={styles.avatarText}>{(match.opponentTag || 'OPP').slice(0, 3)}</Text>
                      </View>
                    )}
                    <Text style={styles.teamName} numberOfLines={2}>{match.opponentName}</Text>
                    <Text style={styles.meta}>OPP</Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.goLive, !isLive && styles.goLiveOff]}
                  onPress={() => onGoLive(match)}
                >
                  <Text style={[styles.goLiveText, !isLive && { color: '#64748b' }]}>
                    {isLive ? 'GO LIVE' : isDone ? 'CLOSED' : `OPENS ${match.label}`}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Pressable
        style={styles.logout}
        onPress={() => {
          setSession(null);
          navigation.replace('Login');
        }}
      >
        <Text style={styles.logoutText}>SIGN OUT</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  headerTitle: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.5 },
  headerName: { fontSize: 20, fontWeight: '900', color: '#f8fafc', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  refreshBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  list: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#94a3b8' },
  warning: { color: '#fbbf24', textAlign: 'center', marginBottom: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  cardLive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  cardDone: { borderColor: '#14532d', backgroundColor: 'rgba(16,185,129,0.06)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dayCol: { width: 52, alignItems: 'center', marginRight: 10 },
  dayLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  dayNum: { fontSize: 26, fontWeight: '900', color: '#f59e0b', lineHeight: 30 },
  title: { color: '#f8fafc', fontWeight: '800', fontSize: 13 },
  time: { color: '#94a3b8', fontSize: 10, marginTop: 2, fontWeight: '600' },
  pill: { backgroundColor: 'rgba(148,163,184,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillLive: { backgroundColor: 'rgba(239,68,68,0.15)' },
  pillDone: { backgroundColor: 'rgba(16,185,129,0.15)' },
  pillText: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
  teams: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  teamCol: { flex: 1, alignItems: 'center' },
  vsCol: { alignItems: 'center', paddingHorizontal: 8 },
  vs: { color: '#64748b', fontWeight: '900', fontSize: 12 },
  logo: { width: 48, height: 48, borderRadius: 10, marginBottom: 6, backgroundColor: '#020617' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  teamName: { color: '#f1f5f9', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  meta: { color: '#64748b', fontSize: 9, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  goLive: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  goLiveOff: { backgroundColor: '#1e293b' },
  goLiveText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  logout: {
    margin: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
  },
  logoutText: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 2 },
});
