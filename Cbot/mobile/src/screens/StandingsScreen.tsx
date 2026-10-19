import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderActionButton } from '../components/HeaderActionButton';
import { PoweredByFooter } from '../components/PoweredByFooter';
import { fetchStandings, type StandingsPayload } from '../api/website';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Standings'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

type FocusCol = 'event' | 'slams' | 'avg' | 'total';

function focusLabel(focus: FocusCol) {
  if (focus === 'event') return 'Event points from each completed combi day (after 9:30pm IST).';
  if (focus === 'slams') return 'Slam bonus · +1 per published slam. Players who scored slams are listed by day.';
  if (focus === 'avg') return 'Target bonus · +1 when a published day’s score is equal to or below that day’s target (Score ≤ Target). Players who earned it are listed by day.';
  return 'Event + slams + target bonus, day by day after the day completes.';
}

function bonusDays(days: any[], kind: 'target' | 'slams') {
  return days
    .map((d: any) => ({ day: d, players: kind === 'target' ? d.targetBonusPlayers || [] : d.slamPlayers || [] }))
    .filter((x: { players: any[] }) => x.players.length > 0);
}

function StatCell({
  value,
  onPress,
  emphasize,
}: {
  value: number | string;
  onPress: () => void;
  emphasize?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.statCell}>
      <Text style={[styles.statValue, emphasize && styles.statValueStrong]}>{value}</Text>
    </Pressable>
  );
}

export function StandingsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StandingsPayload | null>(null);
  const [tab, setTab] = useState<'teams' | 'players'>('teams');
  const [stageId, setStageId] = useState('');
  const [open, setOpen] = useState<{ row: any; focus: FocusCol } | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStandings();
      setPayload(data);
      setStageId((prev) => {
        if (prev && data.blocks.some((b) => b.stageId === prev)) return prev;
        return data.blocks.find((b) => b.current)?.stageId || data.blocks[0]?.stageId || '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load standings.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openVideosForPlayer = useCallback(
    (playerName: string) => {
      navigation.navigate('Videos', { player: playerName, day: undefined, nonce: Date.now() });
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const blocks = payload?.blocks || [];
  const stage = blocks.find((b) => b.stageId === stageId) || blocks[0];
  const players = payload?.players || [];
  const placement = payload?.placement || [];
  const days = open?.row?.days || [];

  const toggleMatchExpanded = (key: string) => {
    setExpandedMatches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const team = (p.teamName || '').toLowerCase();
      const grade = (p.grade || '').toLowerCase();
      return name.includes(q) || team.includes(q) || grade.includes(q);
    });
  }, [players, playerSearch]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>STANDINGS</Text>
          <Text style={styles.title}>{payload?.edition?.title || 'Team standings'}</Text>
        </View>
        <HeaderActionButton label="Refresh" onPress={() => void load()} />
      </View>

      <View style={styles.tabSwitch}>
        <Pressable style={[styles.tabBtn, tab === 'teams' && styles.tabBtnOn]} onPress={() => setTab('teams')}>
          <Text style={[styles.tabBtnText, tab === 'teams' && styles.tabBtnTextOn]}>TEAMS</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'players' && styles.tabBtnOn]} onPress={() => setTab('players')}>
          <Text style={[styles.tabBtnText, tab === 'players' && styles.tabBtnTextOn]}>PLAYERS</Text>
        </Pressable>
      </View>

      {loading && !payload ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <HeaderActionButton label="Try again" onPress={() => void load()} />
        </View>
      ) : tab === 'players' ? (
        <ScrollView contentContainerStyle={styles.list} horizontal={false}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search player, team or grade..."
              placeholderTextColor="#64748b"
              value={playerSearch}
              onChangeText={setPlayerSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {playerSearch.length > 0 && (
              <Pressable style={styles.clearBtn} onPress={() => setPlayerSearch('')}>
                <Text style={styles.clearBtnText}>✕</Text>
              </Pressable>
            )}
          </View>

          {filteredPlayers.length === 0 ? (
            <Text style={styles.empty}>
              {playerSearch ? `No players found matching "${playerSearch}".` : 'No players on the edition roster yet.'}
            </Text>
          ) : (
            <View style={styles.groupCard}>
              <Text style={styles.groupTitle}>Player ranking</Text>
              <Text style={styles.rankHint}>
                Ranked by player average, lowest first ((current average + day average) / 2). Players with equal averages share the same rank.
              </Text>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colRank]}>#</Text>
                <Text style={[styles.th, styles.colPlayer]}>PLAYER</Text>
                <Text style={[styles.th, styles.colTeam]}>TEAM</Text>
                <Text style={[styles.th, styles.colGrd]}>GRD</Text>
                <Text style={[styles.th, styles.colTgt]}>TGT</Text>
                <Text style={[styles.th, styles.colNum]}>SLM</Text>
                <Text style={[styles.th, styles.colWo]}>WO</Text>
                <Text style={[styles.th, styles.colAvg]}>AVG</Text>
              </View>
              {filteredPlayers.map((row: any) => {
                const rankNum = Number(row.rank);
                const isTop1 = rankNum === 1;
                const isTop2 = rankNum === 2;
                const isTop3 = rankNum === 3;
                return (
                  <View key={row.userId} style={styles.tableRow}>
                    <View style={[styles.colRank, styles.rankCell]}>
                      <Text
                        style={[
                          styles.tdRank,
                          isTop1 && styles.rankGold,
                          isTop2 && styles.rankSilver,
                          isTop3 && styles.rankBronze,
                        ]}
                      >
                        {row.rank}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.colPlayer}
                      onPress={() => openVideosForPlayer(row.name)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Watch ${row.name}'s videos`}
                    >
                      <Text style={styles.tdName} numberOfLines={2}>
                        {row.name}
                      </Text>
                      <Text style={styles.tdVideoHint}>▶ VIDEOS</Text>
                    </Pressable>
                    <View style={styles.colTeam}>
                      <Text style={styles.td} numberOfLines={1}>
                        {row.teamName}
                      </Text>
                    </View>
                    <View style={styles.colGrd}>
                      {row.grade ? (
                        <View style={styles.gradeBadge}>
                          <Text style={styles.gradeBadgeText}>{row.grade}</Text>
                        </View>
                      ) : (
                        <Text style={styles.tdDim}>—</Text>
                      )}
                    </View>
                    <Text style={[styles.td, styles.colTgt]}>{row.target ?? '—'}</Text>
                    <Text style={[styles.td, styles.colNum]}>{row.slams ?? 0}</Text>
                    <Text style={[styles.td, styles.colWo]}>{row.walkovers ?? 0}</Text>
                    <Text style={[styles.tdStrong, styles.colAvg]}>
                      {row.boardAverage == null ? '—' : Number(row.boardAverage).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : blocks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>No stages configured yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stageChips}
          >
            {blocks.map((b: any) => {
              const on = (stage?.stageId || stageId) === b.stageId;
              return (
                <Pressable
                  key={b.stageId}
                  style={[styles.stageChip, on && styles.stageChipOn]}
                  onPress={() => setStageId(b.stageId)}
                >
                  <Text style={[styles.stageChipText, on && styles.stageChipTextOn]}>
                    {b.name}
                    {b.current ? ' · NOW' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!stage ? (
            <Text style={styles.empty}>No stages configured yet.</Text>
          ) : stage.knockout?.length ? (
            <>
              {stage.knockout.map((m: any, i: number) => {
                const isT1Winner =
                  m.team1EventPts != null &&
                  m.team2EventPts != null &&
                  m.team1EventPts > m.team2EventPts;
                const isT2Winner =
                  m.team1EventPts != null &&
                  m.team2EventPts != null &&
                  m.team2EventPts > m.team1EventPts;
                const isDraw =
                  m.team1EventPts != null &&
                  m.team2EventPts != null &&
                  m.team1EventPts === m.team2EventPts;

                const matchKey = `${m.label || 'match'}-${i}-${m.team1Name}-${m.team2Name}`;
                const isExpanded = Boolean(expandedMatches[matchKey]);
                const hasEvents = Array.isArray(m.events) && m.events.length > 0;

                return (
                  <View key={matchKey} style={styles.koCard}>
                    {/* Header */}
                    <View style={styles.koHeaderRow}>
                      <View style={styles.koLabelBadge}>
                        <Text style={styles.koLabelText}>{m.label || 'PLAYOFF'}</Text>
                      </View>
                      {m.dayNumber && (
                        <Text style={styles.koDayText}>Day {m.dayNumber}</Text>
                      )}
                    </View>

                    {/* Match matchup & scores */}
                    <View style={styles.koMatchRow}>
                      <View style={styles.koTeamBlock}>
                        <Text
                          style={[
                            styles.koTeamName,
                            isT1Winner && styles.koWinnerName,
                            isT2Winner && styles.koLoserName,
                          ]}
                          numberOfLines={2}
                        >
                          {m.team1Name}
                        </Text>
                        {isT1Winner && (
                          <View style={styles.winnerBadge}>
                            <Text style={styles.winnerBadgeText}>WINNER</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.koScoreContainer}>
                        {m.team1EventPts == null ? (
                          <Text style={styles.koScorePending}>After 9:30pm IST</Text>
                        ) : (
                          <View style={styles.koScorePill}>
                            <Text
                              style={[
                                styles.koScoreNum,
                                isT1Winner && styles.koScoreWinner,
                              ]}
                            >
                              {m.team1EventPts}
                            </Text>
                            <Text style={styles.koScoreSep}>–</Text>
                            <Text
                              style={[
                                styles.koScoreNum,
                                isT2Winner && styles.koScoreWinner,
                              ]}
                            >
                              {m.team2EventPts}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={[styles.koTeamBlock, styles.koTeamBlockRight]}>
                        <Text
                          style={[
                            styles.koTeamName,
                            styles.koTeamNameRight,
                            isT2Winner && styles.koWinnerName,
                            isT1Winner && styles.koLoserName,
                          ]}
                          numberOfLines={2}
                        >
                          {m.team2Name}
                        </Text>
                        {isT2Winner && (
                          <View style={styles.winnerBadge}>
                            <Text style={styles.winnerBadgeText}>WINNER</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Toggle Combis Breakdown Button */}
                    {hasEvents && (
                      <Pressable
                        style={styles.combiToggleBtn}
                        onPress={() => toggleMatchExpanded(matchKey)}
                      >
                        <Text style={styles.combiToggleText}>
                          {isExpanded ? 'Hide Combis ▲' : 'View Combis & Scores ▼'}
                        </Text>
                      </Pressable>
                    )}

                    {/* Combi Events Breakdown (Expanded) */}
                    {isExpanded && hasEvents && (
                      <View style={styles.combiBreakdown}>
                        <Text style={styles.combiSectionTitle}>
                          Combi Events & Individual Scores
                        </Text>
                        {m.events.map((ev: any, evIdx: number) => {
                          const isWin = String(ev.result || '').includes('Win');
                          const isLoss = String(ev.result || '').includes('Loss');
                          const isWO =
                            String(ev.result || '').includes('WO') ||
                            ev.reason === 'walkover' ||
                            ev.reason === 'double-walkover';

                          return (
                            <View
                              key={`${matchKey}-ev-${evIdx}`}
                              style={styles.combiEventCard}
                            >
                              <View style={styles.combiEventHeader}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.combiEventName}>
                                    {ev.name}
                                    {ev.format ? ` (${ev.format})` : ''}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.combiPtsBadge,
                                    isWin && styles.ptsWin,
                                    isLoss && styles.ptsLoss,
                                    isWO && styles.ptsWo,
                                  ]}
                                >
                                  <Text style={styles.combiPtsText}>
                                    {ev.team1Pts ?? 0} – {ev.team2Pts ?? 0} pts
                                  </Text>
                                </View>
                              </View>

                              {/* Team 1 Players & Scores */}
                              <View style={styles.combiTeamSide}>
                                <Text style={styles.combiTeamTagT1}>
                                  {m.team1Name}
                                </Text>
                                <Text style={styles.combiPlayersLine}>
                                  {ev.team1PlayerList && ev.team1PlayerList.length > 0
                                    ? ev.team1PlayerList
                                        .map(
                                          (p: any) =>
                                            `${p.name}${p.score != null ? ` (${p.score})` : ''}${p.isWalkover ? ' [WO]' : ''}`,
                                        )
                                        .join(', ')
                                    : ev.team1Players || '—'}
                                  {ev.team1Score != null ? (
                                    <Text style={styles.combiSum}> = {ev.team1Score}</Text>
                                  ) : null}
                                </Text>
                              </View>

                              {/* Team 2 Players & Scores */}
                              <View style={styles.combiTeamSide}>
                                <Text style={styles.combiTeamTagT2}>
                                  {m.team2Name}
                                </Text>
                                <Text style={styles.combiPlayersLine}>
                                  {ev.team1PlayerList && ev.team2PlayerList?.length > 0
                                    ? ev.team2PlayerList
                                        .map(
                                          (p: any) =>
                                            `${p.name}${p.score != null ? ` (${p.score})` : ''}${p.isWalkover ? ' [WO]' : ''}`,
                                        )
                                        .join(', ')
                                    : ev.team2Players || '—'}
                                  {ev.team2Score != null ? (
                                    <Text style={styles.combiSum}> = {ev.team2Score}</Text>
                                  ) : null}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              {placement.length > 0 ? (
                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Final ranking 1–8</Text>
                  {placement.map((p: any) => (
                    <View key={p.place} style={styles.placeRow}>
                      <Text style={styles.tdRank}>{p.place}.</Text>
                      <Text style={styles.tdName}>{p.teamName}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              {stage.kind === 'LEAGUE' ? (
                <Text style={styles.hint}>Groups from Round Robin positions</Text>
              ) : null}
              {(stage.groups || []).map((g: any) => (
                <View key={g.key} style={styles.groupCard}>
                  <Text style={styles.groupTitle}>{g.name}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 350 }}>
                      <View style={styles.tableHead}>
                        <Text style={[styles.th, styles.colRank]}>#</Text>
                        <Text style={[styles.th, styles.colName]}>TEAM</Text>
                        <Text style={[styles.th, styles.colStat]}>TOT</Text>
                        <Text style={[styles.th, styles.colMiniStat]}>P</Text>
                        <Text style={[styles.th, styles.colMiniStat]}>W</Text>
                        <Text style={[styles.th, styles.colMiniStat]}>L</Text>
                        <Text style={[styles.th, styles.colMiniStat]}>T</Text>
                        <Text style={[styles.th, styles.colStat]}>EVT</Text>
                        <Text style={[styles.th, styles.colStat]}>SLM</Text>
                        <Text style={[styles.th, styles.colStat]}>TGT</Text>
                      </View>
                      {(g.rows || []).map((row: any) => (
                        <View key={row.teamId} style={styles.tableRow}>
                          <Text style={[styles.tdRank, styles.colRank]}>{row.rank}</Text>
                          <Text style={[styles.tdName, styles.colName]} numberOfLines={1}>
                            {row.teamName}
                          </Text>
                          <StatCell
                            value={row.total}
                            emphasize
                            onPress={() => setOpen({ row, focus: 'total' })}
                          />
                          <Text style={[styles.td, styles.colMiniStat, { color: '#94a3b8' }]}>{row.matchesPlayed ?? 0}</Text>
                          <Text style={[styles.td, styles.colMiniStat, { color: '#34d399' }]}>{row.matchesWon ?? 0}</Text>
                          <Text style={[styles.td, styles.colMiniStat, { color: '#f87171' }]}>{row.matchesLost ?? 0}</Text>
                          <Text style={[styles.td, styles.colMiniStat, { color: '#fbbf24' }]}>{row.matchesTied ?? 0}</Text>
                          <StatCell value={row.eventPts} onPress={() => setOpen({ row, focus: 'event' })} />
                          <StatCell value={row.slamBonus} onPress={() => setOpen({ row, focus: 'slams' })} />
                          <StatCell value={row.avgBonus} onPress={() => setOpen({ row, focus: 'avg' })} />
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}
            </>
          )}
          <PoweredByFooter />
        </ScrollView>
      )}

      <Modal visible={Boolean(open)} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{open?.row?.teamName}</Text>
              <Text style={styles.modalSub}>{open ? focusLabel(open.focus) : ''}</Text>
            </View>
            <Pressable style={styles.backBtn} onPress={() => setOpen(null)}>
              <Text style={styles.backBtnText}>CLOSE</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {!days.length ? (
              <Text style={styles.empty}>
                No completed days in this stage yet. Breakdown appears after 9:00pm IST (scores) and
                9:30pm IST (event points).
              </Text>
            ) : (
              <>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { width: 52 }]}>DAY</Text>
                  <Text style={[styles.th, { flex: 1 }]}>VS</Text>
                  <Text style={[styles.th, styles.colStat, open?.focus === 'event' && styles.thOn]}>EVT</Text>
                  <Text style={[styles.th, styles.colStat, open?.focus === 'slams' && styles.thOn]}>SLM</Text>
                  <Text style={[styles.th, styles.colStat, open?.focus === 'avg' && styles.thOn]}>TGT</Text>
                  <Text style={[styles.th, styles.colStat, open?.focus === 'total' && styles.thOn]}>TOT</Text>
                  <Text style={[styles.th, styles.colStat]}>M</Text>
                </View>
                {days.map((d: any) => (
                  <View key={d.dayNumber} style={styles.tableRow}>
                    <Text style={[styles.tdRank, { width: 52 }]}>D{d.dayNumber}</Text>
                    <Text style={[styles.td, { flex: 1 }]} numberOfLines={2}>
                      {d.opponentName || '—'}
                    </Text>
                    <Text style={[styles.td, styles.colStat, open?.focus === 'event' && styles.tdOn]}>
                      {d.eventPts}
                    </Text>
                    <Text style={[styles.td, styles.colStat, open?.focus === 'slams' && styles.thOn]}>
                      {d.slamBonus}
                    </Text>
                    <Text style={[styles.td, styles.colStat, open?.focus === 'avg' && styles.thOn]}>
                      {d.avgBonus}
                    </Text>
                    <Text style={[styles.tdStrong, styles.colStat, open?.focus === 'total' && styles.tdOn]}>
                      {d.total}
                    </Text>
                    <Text style={[styles.td, styles.colStat]}>{d.matchResult || '—'}</Text>
                  </View>
                ))}
                {days.map((d: any) =>
                  (open?.focus === 'event' || open?.focus === 'total') && d.events?.length ? (
                    <View key={`ev-${d.dayNumber}`} style={styles.eventCard}>
                      <Text style={styles.eventKicker}>
                        Day {d.dayNumber} combis{d.opponentName ? ` vs ${d.opponentName}` : ''}
                      </Text>
                      {d.events.map((ev: any, i: number) => (
                        <View key={`${d.dayNumber}-${i}`} style={styles.eventRow}>
                          <Text style={styles.eventName}>
                            {ev.name} · {ev.result} · {ev.myPts}–{ev.oppPts}
                          </Text>
                          <Text style={styles.eventLine}>
                            YOU · {ev.myPlayers || '—'}
                            {ev.myScore != null ? ` (${ev.myScore})` : ''}
                          </Text>
                          <Text style={styles.eventLine}>
                            OPP · {ev.oppPlayers || '—'}
                            {ev.oppScore != null ? ` (${ev.oppScore})` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null,
                )}
                {(open?.focus === 'avg' || open?.focus === 'total') &&
                  (bonusDays(days, 'target').length === 0 && open?.focus === 'avg' ? (
                    <Text style={styles.empty}>No player scored under target on a published day yet.</Text>
                  ) : (
                    bonusDays(days, 'target').map(({ day, players }) => (
                      <View key={`tgt-${day.dayNumber}`} style={styles.eventCard}>
                        <Text style={styles.eventKicker}>
                          Day {day.dayNumber} target bonus{day.opponentName ? ` vs ${day.opponentName}` : ''} · +{day.avgBonus}
                        </Text>
                        {players.map((p: any) => (
                          <View key={`${day.dayNumber}-${p.userId}`} style={styles.eventRow}>
                            <Text style={styles.eventName}>{p.name}</Text>
                            <Text style={styles.eventLine}>
                              {p.score} (target {p.target ?? '—'}) · +1
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  ))}
                {(open?.focus === 'slams' || open?.focus === 'total') &&
                  bonusDays(days, 'slams').map(({ day, players }) => (
                    <View key={`slm-${day.dayNumber}`} style={styles.eventCard}>
                      <Text style={styles.eventKicker}>
                        Day {day.dayNumber} slams{day.opponentName ? ` vs ${day.opponentName}` : ''} · +{day.slamBonus}
                      </Text>
                      {players.map((p: any) => (
                        <View key={`${day.dayNumber}-${p.userId}`} style={styles.eventRow}>
                          <Text style={styles.eventName}>{p.name}</Text>
                          <Text style={styles.eventLine}>
                            {p.slams} slam{p.slams === 1 ? '' : 's'} · +{p.slams}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: '900', color: '#f8fafc', marginTop: 2 },
  sub: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 18 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { color: '#fca5a5', textAlign: 'center' },
  empty: { color: '#94a3b8', textAlign: 'center', lineHeight: 20, paddingVertical: 24 },
  hint: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 8 },
  tabSwitch: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabBtnOn: { backgroundColor: '#f59e0b' },
  tabBtnText: { color: '#94a3b8', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  tabBtnTextOn: { color: '#0f172a' },
  list: { padding: 14, paddingBottom: 36 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  stageChips: { gap: 8, paddingBottom: 12 },
  stageChip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
  },
  stageChipOn: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' },
  stageChipText: { color: '#94a3b8', fontWeight: '900', fontSize: 11 },
  stageChipTextOn: { color: '#f59e0b' },
  groupCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginBottom: 12,
  },
  groupTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 16, marginBottom: 4 },
  rankHint: { color: '#94a3b8', fontSize: 11, fontWeight: '600', lineHeight: 16, marginBottom: 10 },
  tableHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 2 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 2,
  },
  th: { color: '#64748b', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  thOn: { color: '#f59e0b' },
  colRank: { width: 22 },
  colName: { flex: 1, minWidth: 72, paddingRight: 4 },
  colPlayer: { flex: 1.1, minWidth: 64, paddingRight: 4 },
  colTeam: { flex: 0.9, minWidth: 48, paddingRight: 4 },
  colGrd: { width: 34, alignItems: 'center' },
  colTgt: { width: 28, textAlign: 'center' },
  colNum: { width: 32, textAlign: 'right' },
  colWo: { width: 26, textAlign: 'right' },
  colAvg: { width: 44, textAlign: 'right' },
  colStat: { width: 28, textAlign: 'center' },
  colMiniStat: { width: 22, textAlign: 'center' },
  td: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  tdDim: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  tdOn: { color: '#fbbf24', fontWeight: '900' },
  rankCell: { alignItems: 'center', justifyContent: 'center' },
  tdRank: { color: '#f59e0b', fontSize: 12, fontWeight: '900' },
  rankGold: { color: '#fbbf24' },
  rankSilver: { color: '#cbd5e1' },
  rankBronze: { color: '#d97706' },
  tdName: { color: '#f8fafc', fontSize: 12, fontWeight: '800' },
  tdVideoHint: { color: '#f59e0b', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 2 },
  gradeBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  gradeBadgeText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '800',
  },
  tdStrong: { color: '#f8fafc', fontSize: 12, fontWeight: '900' },
  statCell: { width: 32, alignItems: 'center' },
  statValue: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  statValueStrong: { color: '#f8fafc', fontWeight: '900' },

  // Knockout Cards
  koCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 12,
  },
  koHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  koLabelBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  koLabelText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  koDayText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  koMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  koTeamBlock: {
    flex: 1,
    gap: 2,
  },
  koTeamBlockRight: {
    alignItems: 'flex-end',
  },
  koTeamName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  koTeamNameRight: {
    textAlign: 'right',
  },
  koWinnerName: {
    color: '#34d399',
    fontWeight: '900',
  },
  koLoserName: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  winnerBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  winnerBadgeText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  koScoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  koScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  koScoreNum: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
  },
  koScoreWinner: {
    color: '#34d399',
  },
  koScoreSep: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  koScorePending: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  combiToggleBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  combiToggleText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  combiBreakdown: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 8,
  },
  combiSectionTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  combiEventCard: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    gap: 6,
  },
  combiEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  combiEventName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  combiPtsBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  ptsWin: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  ptsLoss: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  ptsWo: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  combiPtsText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '900',
  },
  combiTeamSide: {
    gap: 1,
  },
  combiTeamTagT1: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  combiTeamTagT2: {
    color: '#f472b6',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  combiPlayersLine: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  combiSum: {
    color: '#94a3b8',
    fontWeight: '800',
  },

  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  modalSafe: { flex: 1, backgroundColor: '#020617' },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  modalTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 18 },
  modalSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, lineHeight: 17 },
  modalScroll: { padding: 14, paddingBottom: 28 },
  backBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: { color: '#f8fafc', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  eventCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    padding: 12,
    gap: 10,
  },
  eventKicker: { color: '#f59e0b', fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  eventRow: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 8, gap: 2 },
  eventName: { color: '#f8fafc', fontWeight: '800', fontSize: 12 },
  eventLine: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
});
