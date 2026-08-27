import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EliteSponsorsStrip } from '../components/EliteSponsorsStrip';
import { HeaderActionButton } from '../components/HeaderActionButton';
import { LoginBanner } from '../components/LoginBanner';
import {
  BoardScoreModal,
  boardsFromSaved,
  parseBoardDrafts,
} from '../components/BoardScoreModal';
import { playerScoreUntilNote } from '../score-edit-policy';
import {
  fetchPlayerSchedule,
  fetchPlayerScores,
  getSession,
  submitPlayerDayScore,
  type DayScoreInfo,
  type MatchDetails,
  type MobileTeam,
} from '../api/website';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

function currentMatchDay(matches: MatchDetails[], apiCurrent?: number) {
  const live = matches.filter((m) => m.status === 'LIVE').map((m) => m.dayNumber);
  if (live.length) return Math.max(...live);
  if (typeof apiCurrent === 'number' && apiCurrent > 0) return apiCurrent;
  const completed = matches.filter((m) => m.status === 'COMPLETED').map((m) => m.dayNumber);
  if (completed.length) return Math.max(...completed) + 1;
  const upcoming = matches.map((m) => m.dayNumber).filter((n) => n > 0);
  return upcoming.length ? Math.min(...upcoming) : 1;
}

function MatchDayScoreBox({
  dayNumber,
  scoreInfo,
  saving,
  onOpenBoards,
}: {
  dayNumber: number;
  scoreInfo: DayScoreInfo | null;
  saving: boolean;
  onOpenBoards: () => void;
}) {
  const submitted = (scoreInfo?.scores || []).find((s) => s.dayNumber === dayNumber);
  const published = (scoreInfo?.publishedDays || []).some((d) => d.dayNumber === dayNumber && d.published);
  const dayWindow = (scoreInfo?.days || []).find((d) => d.dayNumber === dayNumber);
  const canEdit = dayWindow ? dayWindow.windowOpen : !published;
  const stats = submitted ? parseBoardDrafts(boardsFromSaved(submitted)) : null;

  let body: ReactNode;
  if (published && !submitted) {
    body = <Text style={styles.scoreLocked}>Empty — walkover if still blank at 9:00pm IST.</Text>;
  } else if (canEdit) {
    body = (
      <>
        {stats?.boardCount ? (
          <Text style={styles.scoreLocked}>
            {stats.total} pts · {stats.slams} slam{stats.slams === 1 ? '' : 's'} · {stats.boardCount} board
            {stats.boardCount === 1 ? '' : 's'}
          </Text>
        ) : (
          <Text style={styles.scoreHint}>No score yet. Enter scores and save.</Text>
        )}
        <Pressable style={[styles.scoreSave, saving && { opacity: 0.55 }]} onPress={onOpenBoards} disabled={saving}>
          <Text style={styles.scoreSaveText}>
            {saving ? 'SAVING…' : submitted ? 'UPDATE SCORES' : 'ENTER SCORES'}
          </Text>
        </Pressable>
        <Text style={styles.scoreHint}>{playerScoreUntilNote(dayNumber)}</Text>
      </>
    );
  } else if (submitted) {
    body = (
      <Text style={styles.scoreLocked}>
        {submitted.score} pts · {submitted.slams ?? 0} slam{(submitted.slams ?? 0) === 1 ? '' : 's'}
        {stats?.boardCount ? ` · ${stats.boardCount} board${stats.boardCount === 1 ? '' : 's'}` : ''}
      </Text>
    );
  } else {
    body = <Text style={styles.scoreHint}>{dayWindow?.windowReason || SCORE_EDIT_PLAYER_CLOSED}</Text>;
  }

  return (
    <View style={styles.scoreBox}>
      <Text style={styles.scoreTitle}>DAY {dayNumber} SCORES</Text>
      {body}
    </View>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const session = getSession();
  const playerName = session?.user.name || 'Player';
  const [team, setTeam] = useState<MobileTeam>(session?.team || null);
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [currentDay, setCurrentDay] = useState(1);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getSession()?.token));
  const [playerView, setPlayerView] = useState<'MAIN' | 'SPOC'>('MAIN');
  const [playerTeams, setPlayerTeams] = useState<Array<{ id: string; name: string; kind: 'MAIN' | 'SPOC'; isCaptain?: boolean }>>([]);
  const [scoreInfo, setScoreInfo] = useState<DayScoreInfo | null>(null);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [boardDay, setBoardDay] = useState<number | null>(null);

  const load = useCallback(async (view: 'MAIN' | 'SPOC' = playerView) => {
    if (!getSession()?.token) {
      setLoading(false);
      setMatches([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchPlayerSchedule({ view });
      setMatches(res.matches);
      setTeam(res.team);
      setPlayerTeams(res.playerTeams || []);
      setCurrentDay(currentMatchDay(res.matches, res.currentDay));
      setWarning(res.warning || (res.matches.length === 0 ? 'No fixtures found for your team.' : null));
      try {
        const scores = await fetchPlayerScores();
        setScoreInfo(scores);
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
  }, [navigation, playerView]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveDayScore = async (dayNumber: number, boards: Array<{ score: number; slams: number }>) => {
    setSavingDay(dayNumber);
    try {
      await submitPlayerDayScore(dayNumber, boards);
      Alert.alert('Saved', `Day ${dayNumber} scores submitted.`);
      setScoreInfo(await fetchPlayerScores());
      setBoardDay(null);
    } catch (e) {
      Alert.alert('Not saved', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingDay(null);
    }
  };

  const openVideosForMatch = (match: MatchDetails) => {
    navigation.navigate('Videos', {
      player: playerName,
      day: match.dayNumber,
      nonce: Date.now(),
    });
  };

  const openLatestVideo = async (match: MatchDetails) => {
    const url = match.latestYoutubeUrl;
    if (url) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // Fall through to the filtered videos list.
      }
    }
    openVideosForMatch(match);
  };

  const onGoLive = (match: MatchDetails, mode: 'match' | 'practice' | 'tiebreak' = 'match') => {
    if (mode === 'match') {
      const liveNow = match.status === 'LIVE' || match.dayNumber === currentDay;
      if (!liveNow && !match.canGoLive) {
        Alert.alert(
          `${match.label} is locked`,
          match.lockedReason ||
            (match.prerequisiteDay
              ? `Go live on Day ${match.prerequisiteDay} and save at least one YouTube video first.`
              : 'This day is not open yet.'),
        );
        return;
      }
    }
    const suffix = mode === 'practice' ? ' Practice' : mode === 'tiebreak' ? ' Tie Breaker' : '';
    navigation.navigate('Live', {
      name: playerName,
      day: `${match.label}${suffix}`,
      teamName: match.teamName,
      opponentName: mode === 'practice' ? 'Practice' : (match.opponentName || 'TBD'),
      teamTag: match.teamTag,
      opponentTag: mode === 'practice' ? 'PRAC' : (match.opponentTag || 'TBD'),
      stage: match.stageName || match.title,
      editionTitle: match.editionTitle,
      timeRange: match.timeRange,
      endIso: mode === 'match' ? match.endIso || undefined : undefined,
      playMode: mode,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>PLAYER DASHBOARD</Text>
          <Text style={styles.headerName}>{playerName === 'Player' && !session?.token ? 'CBOT WORLD' : playerName}</Text>
          <Text style={styles.headerSub}>
            {session?.token
              ? playerView === 'SPOC'
                ? `${team?.name || 'Spoc team'} · Only organizer-scheduled Spoc exhibition days.`
                : `${team?.name || 'No team'} · Play from today through the last day in sequence. Opponent may be TBD.`
              : 'Browse this page now. Log in to view your fixtures and go live.'}
          </Text>
        </View>
        {session?.token ? (
          <HeaderActionButton label="Refresh" onPress={() => void load()} />
        ) : (
          <HeaderActionButton label="Log in" onPress={() => navigation.getParent()?.navigate('Login')} />
        )}
      </View>

      <EliteSponsorsStrip />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#f59e0b" />
          <Text style={styles.muted}>Loading your match schedule...</Text>
        </View>
      ) : !session?.token ? (
        <LoginBanner
          title="Your match schedule"
          message="Log in with your CBOT username and PIN to see your fixtures, go live, and watch saved videos."
          onLogin={() => navigation.getParent()?.navigate('Login')}
        />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {playerTeams.filter((t) => t.kind === 'MAIN').length > 0 && playerTeams.some((t) => t.kind === 'SPOC') ? (
            <View style={styles.viewSwitch}>
              {(['MAIN', 'SPOC'] as const).map((view) => {
                const on = playerView === view;
                const label = view === 'SPOC' ? 'SPOC TEAM' : 'MAIN TEAM';
                const name = playerTeams.find((t) => t.kind === view)?.name || label;
                return (
                  <Pressable
                    key={view}
                    style={[styles.viewBtn, on && (view === 'SPOC' ? styles.viewBtnSpocOn : styles.viewBtnOn)]}
                    onPress={() => {
                      if (view === playerView) return;
                      setPlayerView(view);
                      void load(view);
                    }}
                  >
                    <Text style={[styles.viewBtnText, on && styles.viewBtnTextOn]}>{label}</Text>
                    <Text style={[styles.viewBtnMeta, on && styles.viewBtnTextOn]} numberOfLines={1}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {warning ? <Text style={styles.warning}>{warning}</Text> : null}
          {matches.map((match) => {
            const isLive = match.status === 'LIVE';
            const isCurrent = isLive || match.dayNumber === currentDay;
            const isPast = !isCurrent && match.dayNumber < currentDay;
            const canPlay = isCurrent || (!isPast && Boolean(match.canGoLive));
            const oppIsTbd = !match.opponentName || /^tbd$/i.test(match.opponentName);
            const pill = isLive
              ? 'LIVE'
              : isPast
                ? 'COMPLETED'
                : canPlay
                  ? isCurrent
                    ? 'TODAY'
                    : 'OPEN'
                  : 'LOCKED';
            return (
              <View
                key={match.matchId || match.label}
                style={[
                  styles.card,
                  isLive && styles.cardLive,
                  canPlay && !isLive && styles.cardPlayable,
                  isPast && styles.cardDone,
                  !canPlay && !isPast && styles.cardLocked,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.dayCol}>
                    <Text style={styles.dayLabel}>DAY</Text>
                    <Text
                      style={[
                        styles.dayNum,
                        isLive && { color: '#ef4444' },
                        canPlay && !isLive && { color: '#f59e0b' },
                        isPast && { color: '#34d399' },
                        !canPlay && !isPast && { color: '#64748b' },
                      ]}
                    >
                      {match.dayNumber}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{match.title || match.label}</Text>
                    <Text style={styles.time}>{match.timeRange}</Text>
                    {!canPlay && !isPast && match.prerequisiteDay ? (
                      <Text style={styles.lockHint}>Need a Day {match.prerequisiteDay} YouTube save first</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.pill,
                      isLive && styles.pillLive,
                      canPlay && !isLive && styles.pillPlayable,
                      isPast && styles.pillDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isLive && { color: '#ef4444' },
                        canPlay && !isLive && { color: '#f59e0b' },
                        isPast && { color: '#34d399' },
                      ]}
                    >
                      {pill}
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
                    <Text style={[styles.teamName, oppIsTbd && styles.tbdName]} numberOfLines={2}>
                      {match.opponentName || 'TBD'}
                    </Text>
                    <Text style={styles.meta}>{oppIsTbd ? 'TBD' : 'OPP'}</Text>
                  </View>
                </View>

                {match.myEvent?.revealed ? (
                  <View style={styles.eventBox}>
                    {match.myEvent.selected ? (
                      <>
                        <Text style={styles.eventKicker}>{match.myEvent.format || 'EVENT'}</Text>
                        <Text style={styles.eventName}>{match.myEvent.name || 'Your event'}</Text>
                        <Text style={styles.eventPlayers}>YOU · {match.myEvent.myPlayers.join(', ') || '—'}</Text>
                        <Text style={styles.eventPlayers}>OPP · {match.myEvent.oppPlayers.join(', ') || '—'}</Text>
                        {match.myEvent.scoresReady && match.myEvent.result ? (
                          <Text
                            style={[
                              styles.eventResult,
                              match.myEvent.result === 'WIN' && { color: '#34d399' },
                              match.myEvent.result === 'LOSS' || match.myEvent.result === 'WALKOVER' ? { color: '#f87171' } : null,
                              match.myEvent.result === 'TIE' && { color: '#fbbf24' },
                            ]}
                          >
                            {match.myEvent.result}
                            {match.myEvent.myScore != null && match.myEvent.oppScore != null
                              ? ` · ${match.myEvent.myScore} vs ${match.myEvent.oppScore}`
                              : match.myEvent.result === 'WALKOVER'
                                ? ' · no score'
                                : ''}
                            {typeof match.myEvent.eventPts === 'number' ? ` · +${match.myEvent.eventPts} pts` : ''}
                          </Text>
                        ) : (
                          <Text style={styles.eventHint}>Result posts after 9:00pm IST scores</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.eventHint}>Not selected in this day’s combi</Text>
                    )}
                  </View>
                ) : null}

                <View style={styles.extraRow}>
                  <Pressable
                    style={[styles.extraBtn, styles.tieBtn]}
                    onPress={() => onGoLive(match, 'tiebreak')}
                  >
                    <Text style={styles.tieBtnText}>TIE BREAKER</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.extraBtn, styles.practiceBtn]}
                    onPress={() => onGoLive(match, 'practice')}
                  >
                    <Text style={styles.practiceBtnText}>PRACTICE</Text>
                  </Pressable>
                </View>
                {isPast ? (
                  <Pressable style={styles.watchBtn} onPress={() => openVideosForMatch(match)}>
                    <Text style={styles.watchBtnText}>WATCH YOUTUBE VIDEO</Text>
                  </Pressable>
                ) : (
                  <>
                    {canPlay && match.hasYoutube ? (
                      <Pressable style={styles.watchBtn} onPress={() => void openLatestVideo(match)}>
                        <Text style={styles.watchBtnText}>WATCH VIDEO</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.goLive, !canPlay && styles.goLiveOff]}
                      onPress={() => onGoLive(match, 'match')}
                    >
                      <Text style={[styles.goLiveText, !canPlay && { color: '#64748b' }]}>
                        {canPlay
                          ? match.hasYoutube
                            ? 'GO LIVE AGAIN'
                            : 'GO LIVE'
                          : match.prerequisiteDay
                            ? `NEED DAY ${match.prerequisiteDay} VIDEO`
                            : 'LOCKED'}
                      </Text>
                    </Pressable>
                  </>
                )}
                <MatchDayScoreBox
                  dayNumber={match.dayNumber}
                  scoreInfo={scoreInfo}
                  saving={savingDay === match.dayNumber}
                  onOpenBoards={() => setBoardDay(match.dayNumber)}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
      <BoardScoreModal
        visible={boardDay != null}
        dayNumber={boardDay || 1}
        playerName={playerName}
        target={scoreInfo?.target}
        initialBoards={boardsFromSaved((scoreInfo?.scores || []).find((s) => s.dayNumber === boardDay))}
        busy={boardDay != null && savingDay === boardDay}
        editNote={boardDay ? playerScoreUntilNote(boardDay) : undefined}
        onClose={() => setBoardDay(null)}
        onSave={(boards) => {
          if (boardDay != null) void saveDayScore(boardDay, boards);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  list: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#94a3b8' },
  warning: { color: '#fbbf24', textAlign: 'center', marginBottom: 12, fontWeight: '700' },
  viewSwitch: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  viewBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  viewBtnOn: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' },
  viewBtnSpocOn: { borderColor: '#a78bfa', backgroundColor: 'rgba(139,92,246,0.18)' },
  viewBtnText: { color: '#94a3b8', fontWeight: '900', fontSize: 11, letterSpacing: 0.7 },
  viewBtnTextOn: { color: '#f8fafc' },
  viewBtnMeta: { color: '#64748b', fontSize: 10, fontWeight: '700', marginTop: 2 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  cardLive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  cardPlayable: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' },
  cardDone: { borderColor: '#14532d', backgroundColor: 'rgba(16,185,129,0.06)' },
  cardLocked: { borderColor: '#1e293b', opacity: 0.92 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dayCol: { width: 52, alignItems: 'center', marginRight: 10 },
  dayLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  dayNum: { fontSize: 26, fontWeight: '900', color: '#f59e0b', lineHeight: 30 },
  title: { color: '#f8fafc', fontWeight: '800', fontSize: 13 },
  time: { color: '#94a3b8', fontSize: 10, marginTop: 2, fontWeight: '600' },
  lockHint: { color: '#fbbf24', fontSize: 10, marginTop: 4, fontWeight: '700' },
  pill: { backgroundColor: 'rgba(148,163,184,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillLive: { backgroundColor: 'rgba(239,68,68,0.15)' },
  pillPlayable: { backgroundColor: 'rgba(245,158,11,0.15)' },
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
  tbdName: { color: '#94a3b8', fontStyle: 'italic' },
  meta: { color: '#64748b', fontSize: 9, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  extraRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  eventBox: {
    marginTop: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  eventKicker: { color: '#64748b', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  eventName: { color: '#f59e0b', fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  eventPlayers: { color: '#e2e8f0', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  eventResult: { color: '#f8fafc', fontSize: 12, fontWeight: '900', marginTop: 4 },
  eventHint: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  extraBtn: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
  },
  tieBtn: { borderColor: '#6d28d9', backgroundColor: 'rgba(139,92,246,0.12)' },
  tieBtnText: { color: '#c4b5fd', fontWeight: '800', fontSize: 9, letterSpacing: 0.4 },
  practiceBtn: { borderColor: '#334155', backgroundColor: '#0f172a' },
  practiceBtnText: { color: '#94a3b8', fontWeight: '800', fontSize: 9, letterSpacing: 0.4 },
  goLive: {
    marginTop: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  goLiveOff: { backgroundColor: '#1e293b' },
  goLiveText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  watchBtn: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  watchBtnText: { color: '#f59e0b', fontWeight: '900', letterSpacing: 1 },
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
});
