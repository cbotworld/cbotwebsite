import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { GoLivePromptModal } from '../components/GoLivePromptModal';
import { BoardScoreModal, boardsFromSaved } from '../components/BoardScoreModal';
import { PoweredByFooter } from '../components/PoweredByFooter';
import {
  fetchPlayerSchedule,
  fetchPlayerScores,
  submitPlayerDayScore,
  getSession,
  type DayScoreInfo,
  type MatchDetails,
  type MobileTeam,
  type TournamentOptions,
} from '../api/website';
import { playerScoreUntilNote } from '../score-edit-policy';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAppDialog } from '../components/AppDialog';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

function getIstHour(): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
      10,
    );
  } catch {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    return ist.getHours();
  }
}

function currentMatchDay(matches: MatchDetails[], apiCurrent?: number, isAdvance?: boolean) {
  if (isAdvance) return 0;
  if (typeof apiCurrent === 'number') return apiCurrent;
  const live = matches.filter((m) => m.status === 'LIVE').map((m) => m.dayNumber);
  if (live.length) return Math.max(...live);
  const completed = matches.filter((m) => m.status === 'COMPLETED').map((m) => m.dayNumber);
  if (completed.length) return Math.max(...completed) + 1;
  const upcoming = matches.map((m) => m.dayNumber).filter((n) => n > 0);
  return upcoming.length ? Math.min(...upcoming) : 1;
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
  const [editionSlot, setEditionSlot] = useState<'A' | 'B'>('A');
  const [tournamentOptions, setTournamentOptions] = useState<TournamentOptions | null>(null);
  const [playerTeams, setPlayerTeams] = useState<Array<{ id: string; name: string; kind: 'MAIN' | 'SPOC'; isCaptain?: boolean }>>([]);
  const [scoreInfo, setScoreInfo] = useState<DayScoreInfo | null>(null);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [boardDay, setBoardDay] = useState<number | null>(null);
  const { dialog, showSuccess, showError, showWarn } = useAppDialog();

  const load = useCallback(async (view: 'MAIN' | 'SPOC' = playerView, slot: 'A' | 'B' = editionSlot) => {
    if (!getSession()?.token) {
      setLoading(false);
      setMatches([]);
      return;
    }
    setLoading(true);
    try {
      const [res, scores] = await Promise.all([
        fetchPlayerSchedule({ view, editionSlot: slot }),
        fetchPlayerScores({ slot }).catch(() => null),
      ]);
      setMatches(res.matches);
      setTeam(res.team);
      setPlayerTeams(res.playerTeams || []);
      setTournamentOptions(res.tournamentOptions || null);
      setCurrentDay(currentMatchDay(res.matches, res.currentDay, slot === 'B'));
      setWarning(res.warning || (res.matches.length === 0 ? 'No fixtures found for your team.' : null));
      if (scores) {
        setScoreInfo(scores);
        // Schedule should still show if scores fail.
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load schedule.';
      setWarning(message);
      showWarn('Schedule Error', message);
    } finally {
      setLoading(false);
    }
  }, [playerView, editionSlot]);

  useFocusEffect(
    useCallback(() => {
      void load(playerView, editionSlot);
    }, [load, playerView, editionSlot]),
  );

  const saveDayScore = async (dayNumber: number, boards: Array<{ score: number; slams: number }>) => {
    setSavingDay(dayNumber);
    try {
      await submitPlayerDayScore(dayNumber, boards, { slot: editionSlot });
      showSuccess('Scores Saved! 🎯', `Day ${dayNumber} scores submitted successfully.`);
      setScoreInfo(await fetchPlayerScores({ slot: editionSlot }));
      setBoardDay(null);
    } catch (e) {
      showError('Not Saved', e instanceof Error ? e.message : 'Failed to save scores.');
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

  const [promptMatch, setPromptMatch] = useState<MatchDetails | null>(null);

  const startStreamingMatch = (match: MatchDetails, mode: 'match' | 'practice' | 'tiebreak' = 'match') => {
    const suffix = mode === 'practice' ? ' Practice' : mode === 'tiebreak' ? ' Tie Breaker' : '';
    navigation.navigate('Live', {
      name: playerName,
      day: `${match.label}${suffix}`,
      dayNumber: match.dayNumber,
      teamName: match.teamName,
      opponentName: mode === 'practice' ? 'Practice' : (match.opponentName || 'TBD'),
      teamTag: match.teamTag,
      opponentTag: mode === 'practice' ? 'PRAC' : (match.opponentTag || 'TBD'),
      stage: match.stageName || match.title,
      editionTitle: match.editionTitle,
      editionSlot,
      editionId: match.editionId || undefined,
      timeRange: match.timeRange,
      endIso: mode === 'match' ? match.endIso || undefined : undefined,
      playMode: mode,
    });
  };

  const onGoLive = (match: MatchDetails, mode: 'match' | 'practice' | 'tiebreak' = 'match') => {
    if (mode === 'match') {
      const nowMs = Date.now();
      const endMs = match.endIso ? new Date(match.endIso).getTime() : 0;
      const scoreCutoffMs = endMs ? endMs + 3600000 : 0;
      const isMatchGraceHour = endMs > 0 && scoreCutoffMs > 0 && nowMs >= endMs && nowMs < scoreCutoffMs;
      const isMatchCompleted = (scoreCutoffMs > 0 && nowMs >= scoreCutoffMs) || match.status === 'COMPLETED';

      if (isMatchCompleted && editionSlot !== 'B') {
        showWarn(`${match.label} Closed`, 'Go Live and score submissions are closed for this match day.');
        return;
      }

      if (isMatchGraceHour && !match.hasYoutube && editionSlot !== 'B') {
        showWarn(
          `${match.label} Closed`,
          'Go Live closed at 8:00 PM IST. Replay is only available for players who went live before 8:00 PM. You can still submit your scores using the SUBMIT SCORES button.',
        );
        return;
      }

      if (!match.canGoLive) {
        showWarn(
          `${match.label} Locked`,
          match.lockedReason ||
            (match.prerequisiteDay
              ? `Go live on Day ${match.prerequisiteDay} and save at least one YouTube video first.`
              : 'This day is not open yet.'),
        );
        return;
      }
      // Show description / instructions modal first
      setPromptMatch(match);
    } else {
      startStreamingMatch(match, mode);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.headerWelcome} numberOfLines={1}>
            Welcome, <Text style={styles.headerPlayerName}>{playerName === 'Player' && !session?.token ? 'CBOT WORLD' : playerName}</Text>
          </Text>
        </View>
        {session?.token ? (
          <HeaderActionButton label="Refresh" onPress={() => void load(playerView, editionSlot)} />
        ) : (
          <HeaderActionButton label="Log in" onPress={() => navigation.getParent()?.navigate('Login')} />
        )}
      </View>

      <EliteSponsorsStrip />

      {tournamentOptions?.nextTournament ? (
        <View style={styles.editionToggleContainer}>
          <Pressable
            style={[
              styles.editionToggleBtn,
              editionSlot === 'A' && styles.editionToggleBtnActive,
            ]}
            onPress={() => {
              if (editionSlot === 'A') return;
              setEditionSlot('A');
              void load(playerView, 'A');
            }}
          >
            <Text
              style={[
                styles.editionToggleText,
                editionSlot === 'A' && styles.editionToggleTextActive,
              ]}
            >
              CURRENT EDITION
            </Text>
            <Text
              style={[
                styles.editionToggleSub,
                editionSlot === 'A' && styles.editionToggleSubActive,
              ]}
              numberOfLines={1}
            >
              {tournamentOptions.currentTournament?.title || 'Current Edition'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.editionToggleBtn,
              editionSlot === 'B' && styles.editionToggleBtnActiveB,
            ]}
            onPress={() => {
              if (editionSlot === 'B') return;
              setEditionSlot('B');
              void load(playerView, 'B');
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Text
                style={[
                  styles.editionToggleText,
                  editionSlot === 'B' && styles.editionToggleTextActiveB,
                ]}
              >
                NEXT EDITION
              </Text>
              {tournamentOptions.nextTournament?.isEnrolled ? (
                <View style={styles.enrolledBadge}>
                  <Text style={styles.enrolledBadgeText}>ENROLLED</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.editionToggleSub,
                editionSlot === 'B' && styles.editionToggleSubActiveB,
              ]}
              numberOfLines={1}
            >
              {tournamentOptions.nextTournament.title} (Advance Play)
            </Text>
          </Pressable>
        </View>
      ) : null}

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
                      void load(view, editionSlot);
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
            const nowMs = Date.now();
            const endMs = match.endIso ? new Date(match.endIso).getTime() : 0;
            const scoreCutoffMs = endMs ? endMs + 3600000 : 0;
            const isMatchGraceHour = editionSlot !== 'B' && endMs > 0 && scoreCutoffMs > 0 && nowMs >= endMs && nowMs < scoreCutoffMs;
            const isMatchCompleted = editionSlot !== 'B' && ((scoreCutoffMs > 0 && nowMs >= scoreCutoffMs) || match.status === 'COMPLETED');

            const isLive = match.status === 'LIVE' || isMatchGraceHour;
            const isPast = isMatchCompleted;
            const isCurrent = (isLive || match.dayNumber === currentDay) && editionSlot !== 'B';

            let canPlay = false;
            let goLiveBtnText = 'GO LIVE';

            if (isPast) {
              canPlay = false;
              goLiveBtnText = 'COMPLETED';
            } else if (match.goLiveButtonText) {
              canPlay = Boolean(match.canGoLive);
              goLiveBtnText = match.goLiveButtonText;
            } else if (isMatchGraceHour) {
              if (match.hasYoutube) {
                canPlay = true;
                goLiveBtnText = 'REPLAY';
              } else {
                canPlay = false;
                goLiveBtnText = 'LOCKED';
              }
            } else if (isCurrent) {
              canPlay = true;
              goLiveBtnText = match.hasYoutube ? 'GO LIVE AGAIN' : 'GO LIVE';
            } else {
              canPlay = Boolean(match.canGoLive);
              if (canPlay) {
                goLiveBtnText = match.hasYoutube ? 'GO LIVE AGAIN' : 'GO LIVE';
              } else {
                goLiveBtnText =
                  match.goLiveButtonText ||
                  (match.prerequisiteDay ? `NEED DAY ${match.prerequisiteDay} PLAY` : 'LOCKED');
              }
            }

            const oppIsTbd = !match.opponentName || /^tbd$/i.test(match.opponentName);
            const pill = isLive
              ? isMatchGraceHour && match.hasYoutube
                ? 'REPLAY'
                : 'LIVE'
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
                      <Text style={styles.lockHint}>Play Day {match.prerequisiteDay} first, then Day {match.dayNumber} unlocks</Text>
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
                        {goLiveBtnText}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.submitScoreBtn,
                        savingDay === match.dayNumber && { opacity: 0.6 },
                      ]}
                      onPress={() => setBoardDay(match.dayNumber)}
                      disabled={savingDay === match.dayNumber}
                    >
                      <Text style={styles.submitScoreBtnText}>
                        {savingDay === match.dayNumber
                          ? 'SAVING SCORES…'
                          : (scoreInfo?.scores || []).some((s) => s.dayNumber === match.dayNumber && s.score != null)
                            ? `SUBMIT SCORES (${(scoreInfo?.scores || []).find((s) => s.dayNumber === match.dayNumber)?.score} PTS)`
                            : 'SUBMIT SCORES'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
          <PoweredByFooter />
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
      <GoLivePromptModal
        visible={promptMatch != null}
        match={promptMatch}
        onClose={() => setPromptMatch(null)}
        onConfirmGoLive={() => {
          if (promptMatch) {
            const m = promptMatch;
            setPromptMatch(null);
            startStreamingMatch(m, 'match');
          }
        }}
      />
      {dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  headerWelcome: { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  headerPlayerName: { fontSize: 17, fontWeight: '900', color: '#f8fafc' },
  editionToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  editionToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  editionToggleBtnActive: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  editionToggleBtnActiveB: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  editionToggleText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  editionToggleTextActive: {
    color: '#f59e0b',
  },
  editionToggleTextActiveB: {
    color: '#06b6d4',
  },
  editionToggleSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  editionToggleSubActive: {
    color: '#cbd5e1',
  },
  editionToggleSubActiveB: {
    color: '#cbd5e1',
  },
  enrolledBadge: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  enrolledBadgeText: {
    color: '#10b981',
    fontSize: 8,
    fontWeight: '900',
  },
  list: { flex: 1, paddingHorizontal: 14, paddingTop: 4 },
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
  logo: { width: 48, height: 48, borderRadius: 10, marginBottom: 6, backgroundColor: '#1c0205' },
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
    backgroundColor: '#1c0205',
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
  submitScoreBtn: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  submitScoreBtnText: { color: '#f59e0b', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
});
