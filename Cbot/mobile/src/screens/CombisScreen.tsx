import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchCombis,
  fetchPublicCombis,
  getSession,
  saveCombi,
  submitTeamDayScores,
  type CaptainDesk,
  type CombiDay,
  type CombiMember,
  type CombisPayload,
  type PublicCombiDay,
  type PublicCombiMatch,
} from '../api/website';
import { HeaderActionButton } from '../components/HeaderActionButton';
import { LoginBanner } from '../components/LoginBanner';
import { ScoreEditBanner } from '../components/ScoreEditBanner';
import { SCORE_EDIT_CAPTAIN_HELP } from '../score-edit-policy';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

function displayEventName(name: string, format?: string, slots?: number) {
  const raw = String(name || '').trim();
  const f = String(format || '').toUpperCase();
  const isQuads = f.includes('QUAD') || Number(slots) === 4;
  if (isQuads && /^match/i.test(raw)) return raw.replace(/^match/i, 'Quadruples');
  return raw || name;
}

function splitPlayerNames(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '—' && s !== '-' && !/not submitted|locked until|player \d/i.test(s));
}

type ScoreDraftRow = {
  userId: string;
  name: string;
  score: string;
  slams: string;
  average: number;
  missingPrior: boolean;
};

function memberDayStat(member: CombiMember | undefined, dayNumber?: number) {
  if (!member || !dayNumber) return null;
  return member.dayStats?.[String(dayNumber)] || null;
}

function avgBonusLabel(score: string | number | null | undefined, average: number) {
  if (score == null || score === '') return 'Avg —';
  const n = typeof score === 'number' ? score : parseInt(String(score), 10);
  if (!Number.isFinite(n)) return 'Avg —';
  return n < (Number(average) || 0) ? 'Avg Yes' : 'Avg No';
}

function memberScoreBits(member: CombiMember, dayNumber?: number, draft?: ScoreDraftRow) {
  const st = memberDayStat(member, dayNumber);
  const score = draft?.score ?? (st?.score == null ? '' : String(st.score));
  const slams = draft?.slams ?? (st?.slams == null ? '0' : String(st.slams));
  const average = draft?.average ?? st?.average ?? member.average ?? 0;
  return {
    score,
    slams,
    average,
    avgLabel: score === '' ? null : avgBonusLabel(score, average),
  };
}

function nameInitials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return String(name || '?').slice(0, 2).toUpperCase();
}

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Combis'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export function CombisScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'all' | 'mine'>('mine');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CombisPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CombiDay | null>(null);
  const [draft, setDraft] = useState<string[][]>([]);
  const [picker, setPicker] = useState<{ round: number; slot: number } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [scoreDraft, setScoreDraft] = useState<ScoreDraftRow[]>([]);
  const [savingScores, setSavingScores] = useState(false);
  const [publicDays, setPublicDays] = useState<PublicCombiDay[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [selectedPublicDay, setSelectedPublicDay] = useState<number | null>(null);
  const [deskId, setDeskId] = useState<string | null>(null);

  const loggedIn = Boolean(getSession()?.token);
  const captainDesks: CaptainDesk[] = data?.captainDesks || [];
  const hasBothDesks = captainDesks.length > 1;

  const loadPublic = useCallback(async () => {
    if (!getSession()?.token) {
      setPublicDays([]);
      setPublicLoading(false);
      setPublicError(null);
      return;
    }
    setPublicLoading(true);
    setPublicError(null);
    try {
      const payload = await fetchPublicCombis();
      const days = payload.days || [];
      setPublicDays(days);
      setSelectedPublicDay((prev) => {
        if (prev && days.some((d) => d.dayNumber === prev)) return prev;
        const revealed = [...days].reverse().find((d) => d.revealed);
        return revealed?.dayNumber || days[0]?.dayNumber || null;
      });
    } catch (e) {
      setPublicError(e instanceof Error ? e.message : 'Could not load all combis.');
    } finally {
      setPublicLoading(false);
    }
  }, []);

  const load = useCallback(async (nextDeskId?: string | null) => {
    if (!getSession()?.token) {
      setData(null);
      setLoading(false);
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchCombis(nextDeskId ? { teamId: nextDeskId } : undefined);
      setData(payload);
      const desks: CaptainDesk[] = payload.captainDesks || [];
      const activeId = payload.team?.id || nextDeskId || desks.find((d) => d.kind === 'MAIN')?.id || desks[0]?.id || null;
      setDeskId(activeId);
      if (payload.warning) setError(payload.warning);
      return payload;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load combis.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPublic();
      void load();
    }, [load, loadPublic]),
  );

  const openVideosForPlayer = (name: string, dayNumber?: number) => {
    const player = name.trim();
    const day = dayNumber || selected?.dayNumber;
    if (!player) return;
    setSelected(null);
    setTimeout(() => {
      navigation.navigate('Videos', {
        player,
        day: day && day > 0 ? day : undefined,
        nonce: Date.now(),
      });
    }, 50);
  };

  const openDay = (day: CombiDay) => {
    if (!data) return;
    const metas =
      data.roundsMeta.length > 0
        ? data.roundsMeta
        : (day.rounds || []).map((round, index) => ({
            index,
            format: '',
            name: round.name || `Event ${index + 1}`,
            slots: Math.max(round.playerIds?.length || round.players?.length || 1, 1),
          }));
    const next = metas.map((meta, ri) => {
      const saved = day.rounds[ri];
      return Array.from({ length: meta.slots }, (_, si) => saved?.playerIds?.[si] || '');
    });
    setDraft(next);
    setScoreDraft(
      (data.members || []).map((m) => {
        const st = memberDayStat(m, day.dayNumber);
        return {
          userId: m.id,
          name: m.name,
          score: st?.score == null ? '' : String(st.score),
          slams: st?.slams == null ? '0' : String(st.slams),
          average: st?.average ?? m.average ?? 0,
          missingPrior: Boolean(st?.missingPrior),
        };
      }),
    );
    setSelected(day);
  };

  const memberName = (id: string) => data?.members.find((m) => m.id === id)?.name || 'Select player';
  const memberById = (id: string) => data?.members.find((m) => m.id === id);

  const usedIds = useMemo(() => new Set(draft.flat().filter(Boolean)), [draft]);
  const pickerMembers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const members = data?.members || [];
    if (!q) return members;
    return members.filter((m) => `${m.name} ${m.username || ''}`.toLowerCase().includes(q));
  }, [data?.members, pickerQuery]);

  const openPicker = (round: number, slot: number) => {
    setPickerQuery('');
    setPicker({ round, slot });
  };

  const closePicker = () => {
    setPicker(null);
    setPickerQuery('');
  };

  const setSlot = (round: number, slot: number, playerId: string) => {
    setDraft((prev) =>
      prev.map((ids, ri) => (ri === round ? ids.map((id, si) => (si === slot ? playerId : id)) : ids)),
    );
    closePicker();
  };

  const onSave = async () => {
    if (!data || !selected) return;
    const incomplete = draft.some((ids) => ids.some((id) => !id));
    if (incomplete) {
      Alert.alert('Incomplete combi', 'Pick a player for every slot before saving.');
      return;
    }
    const ids = draft.flat();
    if (new Set(ids).size !== ids.length) {
      Alert.alert('Duplicate player', 'A player can only appear once in the day combi.');
      return;
    }
    setSaving(true);
    try {
      const rounds = data.roundsMeta.map((meta, ri) => ({
        name: meta.name,
        playerIds: draft[ri],
        players: draft[ri].map((id) => memberName(id)),
      }));
      await saveCombi(selected.dayNumber, rounds, data.team?.id || deskId || undefined);
      Alert.alert('Saved', `Day ${selected.dayNumber} combi submitted.`);
      setSelected(null);
      await load(data.team?.id || deskId);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save combi.');
    } finally {
      setSaving(false);
    }
  };

  const onSaveScores = async () => {
    if (!data || !selected) return;
    const filled = scoreDraft.filter((r) => r.score !== '' && !r.missingPrior);
    if (filled.length === 0) {
      Alert.alert('No scores', 'Enter at least one teammate score before saving.');
      return;
    }
    setSavingScores(true);
    try {
      await submitTeamDayScores(
        selected.dayNumber,
        filled.map((r) => ({
          userId: r.userId,
          score: parseInt(r.score, 10),
          slams: parseInt(r.slams || '0', 10),
        })),
        data.team?.id || deskId || undefined,
      );
      Alert.alert('Saved', 'Team scores updated. You can still edit until 9:30 PM IST.');
      const payload = await load(data.team?.id || deskId);
      const dayNum = selected.dayNumber;
      if (payload) {
        setScoreDraft(
          (payload.members || []).map((m) => {
            const st = memberDayStat(m, dayNum);
            return {
              userId: m.id,
              name: m.name,
              score: st?.score == null ? '' : String(st.score),
              slams: st?.slams == null ? '0' : String(st.slams),
              average: st?.average ?? m.average ?? 0,
              missingPrior: Boolean(st?.missingPrior),
            };
          }),
        );
      }
    } catch (e) {
      Alert.alert('Scores not saved', e instanceof Error ? e.message : 'Could not save scores.');
    } finally {
      setSavingScores(false);
    }
  };

  const editing = Boolean(selected && data?.canEdit && !selected.locked);
  const eventRounds =
    (data?.roundsMeta || []).length > 0
      ? data!.roundsMeta
      : (selected?.rounds || []).map((round, index) => ({
          index,
          format: '',
          name: round.name || `Event ${index + 1}`,
          slots: Math.max(round.playerIds?.length || round.players?.length || 1, 1),
        }));
  const visibleDays = (data?.days || []).filter((day) => {
    if (data?.canEdit) return true;
    return day.revealed === true || day.locked === true;
  });
  const h2hEvents = selected?.events?.length
    ? selected.events
    : eventRounds.map((meta, ri) => ({
        index: ri,
        name: meta.name,
        format: meta.format,
        myPlayers: selected?.rounds?.[ri]?.players?.join(', ') || '—',
        opponentPlayers: '—',
      }));
  const pickerRound = picker ? eventRounds[picker.round] : null;
  const pickerEventLabel = pickerRound
    ? displayEventName(pickerRound.name, pickerRound.format, pickerRound.slots)
    : 'Select player';
  const pickerSlotId = picker ? draft[picker.round]?.[picker.slot] || '' : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>DAILY COMBIS</Text>
          <Text style={styles.title}>
            {tab === 'mine' ? data?.team?.name || 'Your team' : 'All combis'}
          </Text>
          <Text style={styles.sub}>
            {loggedIn
              ? tab === 'all'
                ? 'Day chips show every fixture, player vs player after 9:30 PM IST.'
                : hasBothDesks
                  ? data?.isSpocTeam
                    ? 'Spoc exhibition captain desk — submit that match day’s combi here.'
                    : 'Main team captain desk. Switch to Spoc to submit the exhibition combi.'
                  : 'Your team vs that day’s opponent. Tap a player to open their videos.'
              : 'Browse this page now. Log in to view combis.'}
          </Text>
        </View>
        {loggedIn ? (
          <HeaderActionButton
            label="Refresh"
            onPress={() => {
              void loadPublic();
              void load(deskId);
            }}
          />
        ) : (
          <HeaderActionButton label="Log in" onPress={() => navigation.getParent()?.navigate('Login')} />
        )}
      </View>

      <View style={styles.tabSwitch}>
        <Pressable style={[styles.tabBtn, tab === 'mine' && styles.tabBtnOn]} onPress={() => setTab('mine')}>
          <Text style={[styles.tabBtnText, tab === 'mine' && styles.tabBtnTextOn]}>YOUR TEAM</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'all' && styles.tabBtnOn]} onPress={() => setTab('all')}>
          <Text style={[styles.tabBtnText, tab === 'all' && styles.tabBtnTextOn]}>ALL TEAMS</Text>
        </Pressable>
      </View>

      {loggedIn && tab === 'mine' && hasBothDesks ? (
        <View style={styles.deskSwitch}>
          {captainDesks.map((desk) => {
            const on = desk.id === (deskId || data?.team?.id);
            const spoc = desk.kind === 'SPOC';
            return (
              <Pressable
                key={desk.id}
                style={[styles.deskBtn, on && (spoc ? styles.deskBtnSpocOn : styles.deskBtnOn)]}
                onPress={() => {
                  if (desk.id === deskId) return;
                  void load(desk.id);
                }}
              >
                <Text style={[styles.deskBtnText, on && styles.deskBtnTextOn]}>
                  {spoc ? 'SPOC TEAM' : 'MAIN TEAM'}
                </Text>
                <Text style={[styles.deskBtnMeta, on && styles.deskBtnTextOn]} numberOfLines={1}>
                  {desk.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!loggedIn ? (
        <LoginBanner
          title={tab === 'all' ? 'All combis' : 'Your team vs opponent'}
          message="Log in with your CBOT username and PIN to view day-wise combis and your team vs opponent."
          onLogin={() => navigation.getParent()?.navigate('Login')}
        />
      ) : tab === 'all' ? (
        publicLoading && publicDays.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {publicError ? <Text style={styles.error}>{publicError}</Text> : null}
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayChips}
            >
              {publicDays.map((d) => (
                <Pressable
                  key={d.dayNumber}
                  style={[styles.dayChip, selectedPublicDay === d.dayNumber && styles.dayChipOn]}
                  onPress={() => setSelectedPublicDay(d.dayNumber)}
                >
                  <Text style={[styles.dayChipText, selectedPublicDay === d.dayNumber && styles.dayChipTextOn]}>
                    DAY {d.dayNumber}
                  </Text>
                  <Text style={[styles.dayChipMeta, selectedPublicDay === d.dayNumber && styles.dayChipTextOn]}>
                    {d.revealed ? 'OPEN' : 'LOCKED'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {(() => {
              const day = publicDays.find((d) => d.dayNumber === selectedPublicDay);
              if (!day) return <Text style={styles.empty}>No combis scheduled yet.</Text>;
              return (
                <>
                  <Text style={styles.allTitle}>{day.title}</Text>
                  <Text style={styles.cardMeta}>
                    {day.calendarDate || ''} {day.revealed ? '· Released at 9:30 PM IST' : '· Unlocks 9:30 PM IST'}
                  </Text>
                  {day.matches.length === 0 ? (
                    <Text style={styles.empty}>No matches for this day yet.</Text>
                  ) : null}
                  {day.matches.map((match: PublicCombiMatch, idx: number) => (
                    <View key={`${match.team1.id}-${match.team2.id}-${idx}`} style={styles.matchCard}>
                      <View style={styles.vsHeader}>
                        <View style={styles.vsTeam}>
                          {match.team1.logo ? (
                            <Image source={{ uri: match.team1.logo }} style={styles.vsLogo} />
                          ) : (
                            <View style={styles.vsLogoFallback}>
                              <Text style={styles.vsTag}>{(match.team1.tag || 'T1').slice(0, 3)}</Text>
                            </View>
                          )}
                          <Text style={styles.vsName} numberOfLines={2}>
                            {match.team1.name}
                          </Text>
                        </View>
                        <Text style={styles.vsBadge}>VS</Text>
                        <View style={styles.vsTeam}>
                          {match.team2.logo ? (
                            <Image source={{ uri: match.team2.logo }} style={styles.vsLogo} />
                          ) : (
                            <View style={[styles.vsLogoFallback, { backgroundColor: '#1d4ed8' }]}>
                              <Text style={styles.vsTag}>{(match.team2.tag || 'T2').slice(0, 3)}</Text>
                            </View>
                          )}
                          <Text style={styles.vsName} numberOfLines={2}>
                            {match.team2.name}
                          </Text>
                        </View>
                      </View>
                      {day.revealed ? (
                        <Text style={styles.tapHint}>Tap a player name to find their video</Text>
                      ) : (
                        <Text style={styles.tapHint}>Combis publish at 9:30 PM IST</Text>
                      )}
                      {match.events.map((evt) => (
                        <View key={`${idx}-${evt.index}`} style={styles.roundCard}>
                          <Text style={styles.roundName}>{displayEventName(evt.name, evt.format)}</Text>
                          <View style={styles.h2hRow}>
                            <View style={styles.h2hSide}>
                              {splitPlayerNames(evt.leftPlayers).length ? (
                                splitPlayerNames(evt.leftPlayers).map((name) => (
                                  <Pressable
                                    key={`a-${idx}-${evt.index}-${name}`}
                                    onPress={() => openVideosForPlayer(name, day.dayNumber)}
                                    style={styles.playerChip}
                                  >
                                    <Text style={styles.h2hPlayers}>{name}</Text>
                                  </Pressable>
                                ))
                              ) : (
                                <Text style={styles.h2hPlayers}>{evt.leftPlayers}</Text>
                              )}
                            </View>
                            <Text style={styles.h2hVs}>VS</Text>
                            <View style={styles.h2hSide}>
                              {splitPlayerNames(evt.rightPlayers).length ? (
                                splitPlayerNames(evt.rightPlayers).map((name) => (
                                  <Pressable
                                    key={`b-${idx}-${evt.index}-${name}`}
                                    onPress={() => openVideosForPlayer(name, day.dayNumber)}
                                    style={styles.playerChip}
                                  >
                                    <Text style={styles.h2hPlayers}>{name}</Text>
                                  </Pressable>
                                ))
                              ) : (
                                <Text style={styles.h2hPlayers}>{evt.rightPlayers}</Text>
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              );
            })()}
          </ScrollView>
        )
      ) : loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {data?.team && visibleDays.length === 0 ? (
            <Text style={styles.empty}>
              {data.canEdit
                ? 'No combi days yet. Ask the organizer to set the edition calendar.'
                : 'Combis stay hidden until 9:30 PM IST on that day. Revealed days show here as your team vs opponent.'}
            </Text>
          ) : null}
          {!data?.team ? (
            <Text style={styles.empty}>Your account is not assigned to a team yet.</Text>
          ) : null}
          {visibleDays.map((day) => {
            const filled = (day.rounds || []).length > 0;
            return (
              <Pressable
                key={day.dayNumber}
                style={[styles.card, day.locked && styles.cardLocked, filled && styles.cardSaved]}
                onPress={() => openDay(day)}
              >
                <View style={styles.dayCol}>
                  <Text style={styles.dayLabel}>DAY</Text>
                  <Text style={styles.dayNum}>{day.dayNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{day.calendarDate || `Day ${day.dayNumber}`}</Text>
                  <Text style={styles.cardMeta}>
                    {data?.team?.name || 'You'}
                    {day.opponent ? `  vs  ${day.opponent.name}` : '  ·  Opponent TBA'}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {day.revealed ? 'Released' : data?.canEdit ? (day.locked ? 'Locked' : 'Open until 9:30 PM IST') : 'Locks until 9:30 PM IST'}
                    {day.submittedAt ? ` · Saved ${day.submittedAt}` : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>{data?.canEdit && !day.locked ? 'EDIT' : 'VIEW'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => {
          closePicker();
          setSelected(null);
        }}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Day {selected?.dayNumber}</Text>
            <Text style={styles.cardMeta}>{selected?.locked ? 'LOCKED' : editing ? 'EDITING' : 'RELEASED'}</Text>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
          >
            <View style={styles.vsHeader}>
              <View style={styles.vsTeam}>
                {data?.team?.logo ? (
                  <Image source={{ uri: data.team.logo }} style={styles.vsLogo} />
                ) : (
                  <View style={styles.vsLogoFallback}>
                    <Text style={styles.vsTag}>{(data?.team?.tag || 'YOU').slice(0, 3)}</Text>
                  </View>
                )}
                <Text style={styles.vsName} numberOfLines={2}>
                  {data?.team?.name || 'Your team'}
                </Text>
              </View>
              <Text style={styles.vsBadge}>VS</Text>
              <View style={styles.vsTeam}>
                {selected?.opponent?.logo ? (
                  <Image source={{ uri: selected.opponent.logo }} style={styles.vsLogo} />
                ) : (
                  <View style={[styles.vsLogoFallback, { backgroundColor: '#1d4ed8' }]}>
                    <Text style={styles.vsTag}>{(selected?.opponent?.tag || 'OPP').slice(0, 3)}</Text>
                  </View>
                )}
                <Text style={styles.vsName} numberOfLines={2}>
                  {selected?.opponent?.name || 'Opponent TBA'}
                </Text>
              </View>
            </View>

            <Text style={styles.tapHint}>
              {editing
                ? SCORE_EDIT_CAPTAIN_HELP
                : 'Tap a player name to open their YouTube videos for this day'}
            </Text>
            {editing && scoreDraft.length > 0 ? (
              <View style={styles.scoreCard}>
                <ScoreEditBanner forCaptain />
                <Text style={styles.roundName}>TEAM SCORES</Text>
                <Text style={styles.scoreHint}>Avg Yes when the day’s score is under average.</Text>
                {scoreDraft.map((row, idx) => (
                  <View key={row.userId} style={styles.scoreRow}>
                    <Text style={styles.scoreName} numberOfLines={1}>
                      {row.name}
                      {row.missingPrior ? ' · earlier day missing' : ''}
                    </Text>
                    <View style={styles.scoreInputs}>
                      <TextInput
                        style={styles.scoreInput}
                        placeholder="Score"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        editable={!row.missingPrior}
                        value={row.score}
                        onChangeText={(text) => {
                          const next = [...scoreDraft];
                          next[idx] = { ...row, score: text };
                          setScoreDraft(next);
                        }}
                      />
                      <TextInput
                        style={styles.scoreInput}
                        placeholder="Slams"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        editable={!row.missingPrior}
                        value={row.slams}
                        onChangeText={(text) => {
                          const next = [...scoreDraft];
                          next[idx] = { ...row, slams: text };
                          setScoreDraft(next);
                        }}
                      />
                      <Text
                        style={[
                          styles.avgBadge,
                          avgBonusLabel(row.score, row.average) === 'Avg Yes' && styles.avgBadgeYes,
                        ]}
                      >
                        {avgBonusLabel(row.score, row.average)}
                      </Text>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={[styles.saveScores, savingScores && { opacity: 0.6 }]}
                  disabled={savingScores}
                  onPress={() => void onSaveScores()}
                >
                  {savingScores ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <Text style={styles.saveText}>SAVE TEAM SCORES</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
            {h2hEvents.map((evt, ri) => (
              <View key={`${evt.name}-${ri}`} style={styles.roundCard}>
                <Text style={styles.roundName}>{displayEventName(evt.name, evt.format, eventRounds[ri]?.slots)}</Text>
                <View style={styles.h2hRow}>
                  <View style={styles.h2hSide}>
                    {splitPlayerNames(evt.myPlayers).length ? (
                      splitPlayerNames(evt.myPlayers).map((name) => (
                        <Pressable key={`l-${ri}-${name}`} onPress={() => openVideosForPlayer(name, selected?.dayNumber)} style={styles.playerChip}>
                          <Text style={styles.h2hPlayers}>{name}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.h2hPlayers}>{evt.myPlayers || '—'}</Text>
                    )}
                  </View>
                  <Text style={styles.h2hVs}>VS</Text>
                  <View style={styles.h2hSide}>
                    {splitPlayerNames(evt.opponentPlayers).length ? (
                      splitPlayerNames(evt.opponentPlayers).map((name) => (
                        <Pressable key={`r-${ri}-${name}`} onPress={() => openVideosForPlayer(name, selected?.dayNumber)} style={styles.playerChip}>
                          <Text style={styles.h2hPlayers}>{name}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.h2hPlayers}>{evt.opponentPlayers || '—'}</Text>
                    )}
                  </View>
                </View>
                {editing ? (
                  Array.from({ length: eventRounds[ri]?.slots || 1 }).map((_, si) => {
                    const id = draft[ri]?.[si] || '';
                    const member = id ? memberById(id) : undefined;
                    const bits = member
                      ? memberScoreBits(member, selected?.dayNumber, scoreDraft.find((r) => r.userId === id))
                      : null;
                    return (
                      <TouchableOpacity
                        key={`${ri}-${si}`}
                        activeOpacity={0.7}
                        delayPressIn={0}
                        style={styles.slot}
                        onPress={() => openPicker(ri, si)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.slotLabel}>
                            YOUR {(eventRounds[ri]?.slots || 1) === 1 ? 'PLAYER' : `PLAYER ${si + 1}`}
                          </Text>
                          <Text style={styles.slotName} numberOfLines={1}>
                            {member?.name || 'Tap to choose a player'}
                          </Text>
                          {bits ? (
                            <Text style={styles.slotMeta} numberOfLines={1}>
                              {bits.score === ''
                                ? 'No score yet'
                                : `${bits.score} pts  ·  ${bits.slams} slams  ·  ${bits.avgLabel}`}
                            </Text>
                          ) : (
                            <Text style={styles.slotMeta}>From your team roster</Text>
                          )}
                        </View>
                        <Text style={styles.slotChevron}>›</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : null}
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            {editing ? (
              <Pressable style={[styles.save, saving && { opacity: 0.6 }]} disabled={saving} onPress={() => void onSave()}>
                {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>SAVE COMBI</Text>}
              </Pressable>
            ) : null}
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                closePicker();
                setSelected(null);
              }}
            >
              <Text style={styles.backBtnText}>BACK</Text>
            </Pressable>
          </View>

        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(picker)}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <KeyboardAvoidingView
          style={styles.pickerRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.pickerBackdrop} onPress={closePicker} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerKicker}>CHOOSE PLAYER</Text>
                <Text style={styles.pickerTitle} numberOfLines={1}>
                  {pickerEventLabel}
                  {picker && pickerRound && pickerRound.slots > 1 ? ` · Slot ${picker.slot + 1}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {pickerSlotId ? (
                  <Pressable
                    onPress={() => picker && setSlot(picker.round, picker.slot, '')}
                    style={styles.pickerClearBtn}
                  >
                    <Text style={styles.pickerClearText}>Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={closePicker} style={styles.pickerCloseBtn} hitSlop={8}>
                  <Text style={styles.pickerCloseText}>✕</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.pickerSearchWrap}>
              <TextInput
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder="Search name…"
                placeholderTextColor="#64748b"
                autoCorrect={false}
                style={styles.pickerSearch}
              />
            </View>

            <ScrollView
              style={styles.pickerScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {(data?.members || []).length === 0 ? (
                <Text style={styles.empty}>No roster loaded for this team.</Text>
              ) : pickerMembers.length === 0 ? (
                <Text style={styles.empty}>No player matches that search.</Text>
              ) : (
                pickerMembers.map((m: CombiMember) => {
                  const selectedHere = pickerSlotId === m.id;
                  const taken = usedIds.has(m.id) && !selectedHere;
                  const bits = memberScoreBits(
                    m,
                    selected?.dayNumber,
                    scoreDraft.find((r) => r.userId === m.id),
                  );
                  return (
                    <Pressable
                      key={m.id}
                      disabled={taken}
                      onPress={() => picker && setSlot(picker.round, picker.slot, m.id)}
                      style={[
                        styles.pickerRow,
                        selectedHere && styles.pickerRowOn,
                        taken && styles.pickerRowTaken,
                      ]}
                    >
                      <View style={[styles.pickerAvatar, selectedHere && styles.pickerAvatarOn]}>
                        <Text style={styles.pickerAvatarText}>{nameInitials(m.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerName} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <View style={styles.pickerChips}>
                          <Text style={styles.pickerChip}>
                            {bits.score === '' ? 'No score' : `${bits.score} pts`}
                          </Text>
                          <Text style={styles.pickerChip}>
                            {bits.score === '' ? '—' : `${bits.slams} slams`}
                          </Text>
                          {bits.avgLabel ? (
                            <Text
                              style={[
                                styles.pickerChip,
                                bits.avgLabel === 'Avg Yes' && styles.pickerChipYes,
                              ]}
                            >
                              {bits.avgLabel}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {taken ? (
                        <Text style={styles.pickerTaken}>In combi</Text>
                      ) : selectedHere ? (
                        <Text style={styles.pickerCheck}>✓</Text>
                      ) : (
                        <Text style={styles.pickerPick}>Select</Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  empty: { color: '#94a3b8', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  kicker: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: '900', color: '#f8fafc', marginTop: 2 },
  sub: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 18 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 14, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    gap: 10,
  },
  cardLocked: { opacity: 0.85 },
  cardSaved: { borderColor: '#14532d' },
  dayCol: { width: 48, alignItems: 'center' },
  dayLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  dayNum: { fontSize: 24, fontWeight: '900', color: '#f59e0b' },
  cardTitle: { color: '#f8fafc', fontWeight: '800' },
  cardMeta: { color: '#94a3b8', fontSize: 11, marginTop: 3, fontWeight: '600' },
  chevron: { color: '#f59e0b', fontWeight: '800', fontSize: 11 },
  error: { color: '#fca5a5', textAlign: 'center' },
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
  deskSwitch: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 8,
    gap: 8,
  },
  deskBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deskBtnOn: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' },
  deskBtnSpocOn: { borderColor: '#a78bfa', backgroundColor: 'rgba(139,92,246,0.18)' },
  deskBtnText: { color: '#94a3b8', fontWeight: '900', fontSize: 11, letterSpacing: 0.7 },
  deskBtnTextOn: { color: '#f8fafc' },
  deskBtnMeta: { color: '#64748b', fontSize: 10, fontWeight: '700', marginTop: 2 },
  dayChips: { gap: 8, paddingBottom: 12 },
  dayChip: {
    minWidth: 72,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
  },
  dayChipOn: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' },
  dayChipText: { color: '#94a3b8', fontWeight: '900', fontSize: 11 },
  dayChipTextOn: { color: '#f59e0b' },
  dayChipMeta: { color: '#64748b', fontSize: 9, fontWeight: '800', marginTop: 2 },
  allTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 16, marginBottom: 4 },
  matchCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginTop: 12,
  },
  modalSafe: { flex: 1, backgroundColor: '#020617' },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 18 },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 16, paddingBottom: 20 },
  vsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  vsTeam: { flex: 1, alignItems: 'center' },
  vsLogo: { width: 52, height: 52, borderRadius: 12, marginBottom: 6, backgroundColor: '#020617' },
  vsLogoFallback: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  vsTag: { color: '#fff', fontWeight: '900', fontSize: 12 },
  vsName: { color: '#f8fafc', fontWeight: '800', fontSize: 11, textAlign: 'center' },
  vsBadge: { color: '#f59e0b', fontWeight: '900', paddingHorizontal: 8 },
  h2hRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h2hSide: { flex: 1, paddingVertical: 4, alignItems: 'center', gap: 6 },
  playerChip: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tapHint: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  h2hPlayers: { color: '#fbbf24', fontWeight: '800', fontSize: 12, textAlign: 'center', textTransform: 'uppercase', textDecorationLine: 'underline' },
  h2hVs: { color: '#64748b', fontWeight: '900', fontSize: 11 },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#020617',
    gap: 10,
  },
  backBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: { color: '#f8fafc', fontWeight: '900', fontSize: 16, letterSpacing: 1.4 },
  roundCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roundName: { color: '#f59e0b', fontWeight: '800', marginBottom: 10, letterSpacing: 0.6, textAlign: 'center' },
  slot: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  slotLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  slotName: { color: '#f8fafc', fontWeight: '800', marginTop: 3, fontSize: 15 },
  slotMeta: { color: '#94a3b8', fontWeight: '600', marginTop: 3, fontSize: 12 },
  slotChevron: { color: '#f59e0b', fontSize: 28, fontWeight: '700', lineHeight: 30 },
  scoreCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#14532d',
  },
  scoreHint: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  scoreRow: { marginBottom: 10 },
  scoreName: { color: '#e2e8f0', fontWeight: '800', fontSize: 12, marginBottom: 6 },
  scoreInputs: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  scoreInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    color: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontWeight: '700',
  },
  avgBadge: { color: '#94a3b8', fontWeight: '900', fontSize: 11, width: 64 },
  avgBadgeYes: { color: '#34d399' },
  saveScores: { backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  save: { backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#0f172a', fontWeight: '900', letterSpacing: 1.2 },
  pickerRoot: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  pickerSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderBottomWidth: 0,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    marginBottom: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  pickerKicker: { color: '#f59e0b', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  pickerTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 18, marginTop: 2 },
  pickerClearBtn: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickerClearText: { color: '#fca5a5', fontWeight: '800', fontSize: 12 },
  pickerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCloseText: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  pickerSearchWrap: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  pickerSearch: {
    color: '#f8fafc',
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickerScroll: { maxHeight: 460 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pickerRowOn: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  pickerRowTaken: { opacity: 0.55 },
  pickerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarOn: { backgroundColor: '#f59e0b' },
  pickerAvatarText: { color: '#f8fafc', fontWeight: '900', fontSize: 13 },
  pickerName: { color: '#f8fafc', fontWeight: '800', fontSize: 15 },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  pickerChip: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pickerChipYes: { color: '#34d399', backgroundColor: 'rgba(52,211,153,0.12)' },
  pickerTaken: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  pickerCheck: { color: '#f59e0b', fontSize: 18, fontWeight: '900' },
  pickerPick: { color: '#f59e0b', fontSize: 12, fontWeight: '800' },
});
