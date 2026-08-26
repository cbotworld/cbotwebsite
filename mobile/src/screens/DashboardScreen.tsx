import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  fetchPlayerSchedule,
  fetchPlayerScores,
  getSession,
  setSession,
  submitPlayerDayScore,
  type DayScoreInfo,
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
  const [scoreInfo, setScoreInfo] = useState<DayScoreInfo | null>(null);
  const [dayDrafts, setDayDrafts] = useState<Record<number, { score: string; slams: string }>>({});
  const [savingDay, setSavingDay] = useState<number | null>(null);

  const applyScores = (scores: DayScoreInfo) => {
    setScoreInfo(scores);
    const drafts: Record<number, { score: string; slams: string }> = {};
    for (const s of scores.scores || []) {
      drafts[s.dayNumber] = { score: String(s.score), slams: String(s.slams ?? 0) };
    }
    setDayDrafts(drafts);
  };

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
      try {
        applyScores(await fetchPlayerScores());
      } catch {
        // Schedule should still show if scores fail.
      }
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
        `${match.label} locked`,
        match.lockedReason ||
          (match.prerequisiteDay
            ? `Save at least one YouTube link for Day ${match.prerequisiteDay} first.`
            : 'This match day is not unlocked yet.'),
      );
      return;
    }
    navigation.navigate('Live', { name: playerName, day: match.label });
  };

  const saveDayScore = async (dayNumber: number) => {
    const draft = dayDrafts[dayNumber] || { score: '', slams: '0' };
    const score = parseInt(draft.score, 10);
    const slams = parseInt(draft.slams || '0', 10);
    if (!Number.isFinite(score) || score < 0) {
      Alert.alert('Score', 'Enter a valid day score (0 or more).');
      return;
    }
    setSavingDay(dayNumber);
    try {
      await submitPlayerDayScore(dayNumber, score, Number.isFinite(slams) ? slams : 0);
      Alert.alert('Saved', `Day ${dayNumber} score submitted.`);
      applyScores(await fetchPlayerScores());
    } catch (e) {
      Alert.alert('Not saved', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingDay(null);
    }
  };

  const renderDayScore = (dayNumber: number) => {
    const submitted = (scoreInfo?.scores || []).find((s) => s.dayNumber === dayNumber);
    const published = (scoreInfo?.publishedDays || []).some((d) => d.dayNumber === dayNumber && d.published);
    const canEdit = Boolean(scoreInfo?.windowOpen) && Number(scoreInfo?.eligibleDay) === dayNumber;
    const draft = dayDrafts[dayNumber] || { score: '', slams: '0' };
    const saving = savingDay === dayNumber;
    let body: ReactNode;
    if (published && !submitted) {
      body = <Text style={styles.scoreLocked}>Walkover</Text>;
    } else if (canEdit) {
      body = (
        <>
          <View style={styles.scoreInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreLabel}>SCORE</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="number-pad"
                value={draft.score}
                onChangeText={(t) =>
                  setDayDrafts((prev) => ({
                    ...prev,
                    [dayNumber]: { score: t.replace(/[^\d]/g, ''), slams: prev[dayNumber]?.slams ?? '0' },
                  }))
                }
                placeholder="0"
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={{ width: 88 }}>
              <Text style={styles.scoreLabel}>SLAMS</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="number-pad"
                value={draft.slams}
                onChangeText={(t) =>
                  setDayDrafts((prev) => ({
                    ...prev,
                    [dayNumber]: { score: prev[dayNumber]?.score ?? '', slams: t.replace(/[^\d]/g, '') },
                  }))
                }
                placeholder="0"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>
          <Pressable style={[styles.scoreSave, saving && { opacity: 0.55 }]} onPress={() => void saveDayScore(dayNumber)} disabled={saving}>
            <Text style={styles.scoreSaveText}>{saving ? 'SAVING…' : submitted ? 'UPDATE SCORE' : 'SUBMIT SCORE'}</Text>
          </Pressable>
          <Text style={styles.scoreHint}>Until 8:00pm IST · you can overwrite until then</Text>
        </>
      );
    } else if (submitted) {
      body = (
        <Text style={styles.scoreLocked}>
          Score {submitted.score} · {submitted.slams ?? 0} slam{(submitted.slams ?? 0) === 1 ? '' : 's'}
        </Text>
      );
    } else {
      const reason =
        Number(scoreInfo?.eligibleDay) > 0 && Number(scoreInfo?.eligibleDay) < dayNumber
          ? `Submit Day ${scoreInfo?.eligibleDay} first`
          : scoreInfo?.windowReason || 'Opens after the match · until 8:00pm IST';
      body = <Text style={styles.scoreHint}>{reason}</Text>;
    }
    return (
      <View style={styles.scoreBox}>
        <Text style={styles.scoreTitle}>DAY {dayNumber} SCORE</Text>
        {body}
      </View>
    );
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
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
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

                {match.myEvent?.revealed ? (
                  <View style={styles.eventBox}>
                    {match.myEvent.selected ? (
                      <>
                        <Text style={styles.eventName}>{match.myEvent.name || 'Your event'}</Text>
                        <Text style={styles.eventPlayers}>YOU · {match.myEvent.myPlayers.join(', ') || '—'}</Text>
                        <Text style={styles.eventPlayers}>OPP · {match.myEvent.oppPlayers.join(', ') || '—'}</Text>
                        {match.myEvent.scoresReady && match.myEvent.result ? (
                          <Text style={styles.eventResult}>
                            {match.myEvent.result}
                            {match.myEvent.myScore != null && match.myEvent.oppScore != null
                              ? ` · ${match.myEvent.myScore} vs ${match.myEvent.oppScore}`
                              : ''}
                          </Text>
                        ) : (
                          <Text style={styles.eventHint}>Result after 8:00pm IST</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.eventHint}>Not selected in this day’s combi</Text>
                    )}
                  </View>
                ) : null}

                <Pressable
                  style={[styles.goLive, !match.canGoLive && styles.goLiveOff]}
                  onPress={() => onGoLive(match)}
                >
                  <Text style={[styles.goLiveText, !match.canGoLive && { color: '#64748b' }]}>
                    {!match.canGoLive
                      ? match.prerequisiteDay
                        ? `NEED DAY ${match.prerequisiteDay} YT`
                        : 'LOCKED'
                      : match.hasYoutube
                        ? 'GO LIVE AGAIN'
                        : isLive
                          ? 'GO LIVE'
                          : 'GO LIVE'}
                  </Text>
                </Pressable>
                {renderDayScore(match.dayNumber)}
                {match.latestYoutubeUrl ? (
                  <Pressable
                    style={styles.ytBtn}
                    onPress={() => {
                      Linking.openURL(match.latestYoutubeUrl!).catch(() =>
                        Alert.alert('Error', 'Could not open YouTube.'),
                      );
                    }}
                  >
                    <Text style={styles.ytBtnText}>
                      Latest YouTube{(match.streamCount || 0) > 1 ? ` · ${match.streamCount} saves` : ''}
                    </Text>
                  </Pressable>
                ) : null}
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
  eventBox: {
    marginTop: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  eventName: { color: '#f59e0b', fontSize: 12, fontWeight: '900' },
  eventPlayers: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  eventResult: { color: '#f8fafc', fontSize: 12, fontWeight: '900', marginTop: 4 },
  eventHint: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  goLiveOff: { backgroundColor: '#1e293b' },
  goLiveText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  scoreBox: {
    marginTop: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  scoreTitle: { fontSize: 10, fontWeight: '900', color: '#f59e0b', letterSpacing: 1.2 },
  scoreInputs: { flexDirection: 'row', gap: 8 },
  scoreLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 0.8, marginBottom: 4 },
  scoreInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  scoreSave: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  scoreSaveText: { color: '#0f172a', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  scoreHint: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  scoreLocked: { fontSize: 14, color: '#f8fafc', fontWeight: '800' },
  ytBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ytBtnText: { color: '#fca5a5', fontWeight: '800', fontSize: 11 },
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
