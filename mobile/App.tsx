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
  getChannelVideos,
  getPlayerScores,
  submitPlayerScore,
  MatchDetails,
} from './services/api';
import { StandingsScreen } from './src/screens/StandingsScreen';
import {
  BoardScoreModal,
  boardsFromSaved,
  dayWindowOpen,
  dayWindowReason,
  parseBoardDrafts,
  targetBonus,
} from './src/components/BoardScoreModal';
import { ScoreEditBanner } from './src/components/ScoreEditBanner';
import {
  SCORE_EDIT_CAPTAIN_CLOSED,
  SCORE_EDIT_CAPTAIN_HELP,
  SCORE_EDIT_PLAYER_HELP,
} from './src/score-edit-policy';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Screen = 'login' | 'matches' | 'combis' | 'standings' | 'videos' | 'live' | 'scores';

type CombiDay = NonNullable<Awaited<ReturnType<typeof getPlayerCombis>>['days']>[number];
type ChannelVideo = NonNullable<Awaited<ReturnType<typeof getChannelVideos>>['videos']>[number];

const LOCKED_PLAYER_LABELS = new Set([
  'not submitted yet',
  'na',
  'n/a',
  '—',
  '-',
  'locked until 9:30 pm ist',
  'player 1',
  'player 2',
  'player 3',
  'player 4',
]);

function splitPlayerNames(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !LOCKED_PLAYER_LABELS.has(s.toLowerCase()));
}

function TabBar({
  active,
  onMatches,
  onCombis,
  onStandings,
  onVideos,
  onScores,
}: {
  active: Screen;
  onMatches: () => void;
  onCombis: () => void;
  onStandings: () => void;
  onVideos: () => void;
  onScores: () => void;
}) {
  return (
    <View style={styles.tabRow}>
      <TouchableOpacity style={[styles.tabBtn, active === 'matches' && styles.tabBtnActive]} onPress={onMatches}>
        <Text style={[styles.tabText, active === 'matches' && styles.tabTextActive]}>MATCHES</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabBtn, active === 'combis' && styles.tabBtnActive]} onPress={onCombis}>
        <Text style={[styles.tabText, active === 'combis' && styles.tabTextActive]}>COMBIS</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabBtn, active === 'standings' && styles.tabBtnActive]} onPress={onStandings}>
        <Text style={[styles.tabText, active === 'standings' && styles.tabTextActive]}>STAND</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabBtn, active === 'scores' && styles.tabBtnActive]} onPress={onScores}>
        <Text style={[styles.tabText, active === 'scores' && styles.tabTextActive]}>SCORES</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabBtn, active === 'videos' && styles.tabBtnActive]} onPress={onVideos}>
        <Text style={[styles.tabText, active === 'videos' && styles.tabTextActive]}>VIDEOS</Text>
      </TouchableOpacity>
    </View>
  );
}

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
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoPlayerFilter, setVideoPlayerFilter] = useState('');
  const [videoDayFilter, setVideoDayFilter] = useState<number | 'ALL'>('ALL');
  const [videoSearchDraft, setVideoSearchDraft] = useState('');
  const [videoDayDraft, setVideoDayDraft] = useState('');

  // Login State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [scoreDay, setScoreDay] = useState(1);
  const [scoreValue, setScoreValue] = useState('');
  const [slamValue, setSlamValue] = useState('0');
  const [scoreInfo, setScoreInfo] = useState<any>(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [teamRows, setTeamRows] = useState<Array<{
    userId: string;
    name: string;
    score: string;
    slams: string;
    missingPrior?: boolean;
    average?: number;
    target?: number;
    boards?: Array<{ score?: number; slams?: number }>;
  }>>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [dayDrafts, setDayDrafts] = useState<Record<number, { score: string; slams: string }>>({});
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [boardDay, setBoardDay] = useState<number | null>(null);
  const [teamBoardPlayer, setTeamBoardPlayer] = useState<{
    userId: string;
    name: string;
    target?: number;
    boards?: Array<{ score?: number; slams?: number }>;
    score?: number;
    slams?: number;
  } | null>(null);

  const loadScores = async (authToken: string, day?: number) => {
    const res = await getPlayerScores(authToken, day);
    if (res.success) {
      setScoreInfo(res);
      if (day) setScoreDay(day);
      else if (res.eligibleDay) setScoreDay(res.eligibleDay);
      const drafts: Record<number, { score: string; slams: string }> = {};
      for (const s of res.scores || []) {
        drafts[s.dayNumber] = { score: String(s.score), slams: String(s.slams ?? 0) };
      }
      setDayDrafts(drafts);
      const existing = (res.scores || []).find((s: any) => s.dayNumber === (day || res.eligibleDay));
      if (existing) {
        setScoreValue(String(existing.score));
        setSlamValue(String(existing.slams ?? 0));
      }
      setTeamRows(
        (res.teammates || []).map((p: any) => ({
          userId: p.userId,
          name: p.name,
          score: p.score == null ? '' : String(p.score),
          slams: p.slams == null ? '0' : String(p.slams),
          missingPrior: Boolean(p.missingPrior),
          average: Number(p.averageInEffect ?? p.average) || 0,
          target: Number(p.target) || 0,
          boards: Array.isArray(p.boards) ? p.boards : [],
        })),
      );
    }
  };

  const saveBoards = async (dayNumber: number, boards: Array<{ score: number; slams: number }>) => {
    if (!token) return;
    const stats = parseBoardDrafts(boards.map((b) => ({ score: String(b.score), slams: String(b.slams) })));
    setSavingDay(dayNumber);
    const res = await submitPlayerScore(token, {
      dayNumber,
      score: stats.total,
      slams: stats.slams,
      boards,
    });
    if (res.success) {
      Alert.alert('Saved', `Day ${dayNumber} boards submitted.`);
      setBoardDay(null);
      await loadScores(token, dayNumber);
    } else {
      Alert.alert('Not saved', res.error || 'Failed');
    }
    setSavingDay(null);
  };

  const saveTeamBoards = async (userId: string, name: string, boards: Array<{ score: number; slams: number }>) => {
    if (!token) return;
    const stats = parseBoardDrafts(boards.map((b) => ({ score: String(b.score), slams: String(b.slams) })));
    const dayNumber = scoreDay || scoreInfo?.teamDayNumber || scoreInfo?.eligibleDay || 1;
    setTeamBusy(true);
    const res = await submitPlayerScore(token, {
      dayNumber,
      teamId: scoreInfo?.teamId,
      rows: [{ userId, score: stats.total, slams: stats.slams, boards }],
    });
    if (res.success) {
      Alert.alert('Saved', `${name} · Day ${dayNumber} boards saved.`);
      setTeamBoardPlayer(null);
      await loadScores(token, dayNumber);
    } else {
      Alert.alert('Not saved', res.error || 'Failed');
    }
    setTeamBusy(false);
  };

  const renderMatchDayScore = (dayNumber: number) => {
    const submitted = (scoreInfo?.scores || []).find((s: any) => s.dayNumber === dayNumber);
    const published = (scoreInfo?.publishedDays || []).some(
      (d: any) => d.dayNumber === dayNumber && d.published,
    );
    const canEdit = dayWindowOpen(scoreInfo, dayNumber);
    const stats = submitted
      ? parseBoardDrafts(boardsFromSaved(submitted))
      : null;
    const bonus = stats ? targetBonus(stats.boardCount ? stats.total : null, scoreInfo?.target) : null;
    const tgt = Number(scoreInfo?.target) || 0;

    let body: React.ReactNode;
    if (published && !submitted) {
      body = <Text style={styles.cardScoreLocked}>Walkover</Text>;
    } else if (canEdit) {
      body = (
        <>
          {stats?.boardCount ? (
            <Text style={styles.cardScoreHint}>
              Total {stats.total} · {stats.boardCount} boards · Avg {stats.average} · Target {tgt > 0 ? tgt : 0}
              {bonus === true ? ' · Bonus Yes' : tgt > 0 ? ' · Bonus No' : ''}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.cardScoreSave, savingDay === dayNumber && { opacity: 0.55 }]}
            onPress={() => setBoardDay(dayNumber)}
            disabled={savingDay === dayNumber}
          >
            <Text style={styles.cardScoreSaveText}>
              {submitted ? 'UPDATE BOARDS' : 'SUBMIT BOARDS'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.cardScoreHint}>{SCORE_EDIT_PLAYER_HELP}</Text>
        </>
      );
    } else if (submitted) {
      body = (
        <Text style={styles.cardScoreLocked}>
          Total {submitted.score} · {stats?.boardCount || 0} boards · Avg {stats?.average ?? '—'} ·{' '}
          {submitted.slams ?? 0} slam{(submitted.slams ?? 0) === 1 ? '' : 's'}
          {bonus === true ? ' · Bonus Yes' : tgt > 0 ? ' · Bonus No' : ''}
        </Text>
      );
    } else {
      body = <Text style={styles.cardScoreHint}>{dayWindowReason(scoreInfo, dayNumber)}</Text>;
    }

    return (
      <View style={styles.cardScoreBox}>
        <Text style={styles.cardScoreTitle}>DAY {dayNumber} SCORE</Text>
        {body}
      </View>
    );
  };

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

  const loadVideos = async (
    authToken: string,
    opts?: { player?: string; day?: number | 'ALL' },
  ) => {
    setVideosLoading(true);
    try {
      const player = opts?.player ?? videoPlayerFilter;
      const day = opts?.day ?? videoDayFilter;
      const res = await getChannelVideos(authToken, {
        player: player.trim() || undefined,
        day,
      });
      if (res.success) {
        setVideos(res.videos || []);
      }
    } finally {
      setVideosLoading(false);
    }
  };

  const applyVideoQuery = (player: string, dayRaw: string) => {
    const cleaned = player.trim();
    const dayNum = parseInt(String(dayRaw || '').trim(), 10);
    const day = Number.isFinite(dayNum) && dayNum > 0 ? dayNum : 'ALL';
    setVideoPlayerFilter(cleaned);
    setVideoDayFilter(day);
    if (token) void loadVideos(token, { player: cleaned, day });
  };

  const openVideosForPlayer = (player: string, day?: number | null) => {
    const cleaned = player.trim();
    if (!cleaned) return;
    setVideoPlayerFilter(cleaned);
    setVideoSearchDraft(cleaned);
    setVideoDayFilter(day && day > 0 ? day : 'ALL');
    setVideoDayDraft(day && day > 0 ? String(day) : '');
    setScreen('videos');
    if (token) {
      void loadVideos(token, { player: cleaned, day: day && day > 0 ? day : 'ALL' });
    }
  };

  const renderTappablePlayers = (raw: string, dayNumber: number, align: 'left' | 'right') => {
    const names = splitPlayerNames(raw);
    if (!names.length) {
      return (
        <Text
          style={[align === 'left' ? styles.combiPlayersLeft : styles.combiPlayersRight, { opacity: 0.7 }]}
          numberOfLines={3}
        >
          {raw || '—'}
        </Text>
      );
    }
    return (
      <View style={align === 'left' ? styles.combiPlayersWrapLeft : styles.combiPlayersWrapRight}>
        {names.map((name, idx) => (
          <TouchableOpacity key={`${name}-${idx}`} onPress={() => openVideosForPlayer(name, dayNumber)} activeOpacity={0.7}>
            <Text
              style={[
                align === 'left' ? styles.combiPlayersLeft : styles.combiPlayersRight,
                styles.combiPlayerLink,
              ]}
              numberOfLines={2}
            >
              {name}{idx < names.length - 1 ? ',' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
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
        await loadScores(res.token);
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
        `${match.label} locked`,
        match.lockedReason ||
          (match.prerequisiteDay
            ? `Save at least one YouTube link for Day ${match.prerequisiteDay} first. You can still go live again on that day.`
            : 'This match day is not unlocked yet.'),
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
                await loadScores(token);
              }
            }}
          >
            <Text style={styles.headerRefreshText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        <TabBar
          active="matches"
          onMatches={() => setScreen('matches')}
          onCombis={() => setScreen('combis')}
          onStandings={() => setScreen('standings')}
          onScores={() => {
            setScreen('scores');
            if (token) void loadScores(token);
          }}
          onVideos={() => {
            setScreen('videos');
            if (token) void loadVideos(token);
          }}
        />

        <ScrollView
          style={styles.matchList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <ScoreEditBanner />
          </View>
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
              <View
                key={match.matchId || match.label}
                style={[
                  styles.matchCard,
                  isLive && styles.matchCardLive,
                  isDone && styles.matchCardDone,
                ]}
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

                <TouchableOpacity
                  style={styles.goLiveRow}
                  onPress={() => handleSelectMatch(match)}
                  activeOpacity={match.canGoLive ? 0.85 : 1}
                >
                  <Text
                    style={[
                      styles.goLiveText,
                      match.canGoLive
                        ? match.hasYoutube
                          ? { color: '#a78bfa' }
                          : isLive
                            ? { color: '#ef4444' }
                            : { color: '#f59e0b' }
                        : { color: '#64748b' },
                    ]}
                  >
                    {!match.canGoLive
                      ? match.prerequisiteDay
                        ? `🔒 NEED DAY ${match.prerequisiteDay} YOUTUBE FIRST`
                        : '🔒 LOCKED'
                      : match.hasYoutube
                        ? '🔁 GO LIVE AGAIN →'
                        : isLive
                          ? '🔴 GO LIVE ON YOUTUBE →'
                          : '🔴 GO LIVE →'}
                  </Text>
                </TouchableOpacity>

                {renderMatchDayScore(match.dayNumber)}

                {match.latestYoutubeUrl ? (
                  <TouchableOpacity
                    style={styles.ytLinkRow}
                    onPress={() => {
                      Linking.openURL(match.latestYoutubeUrl!).catch(() =>
                        Alert.alert('Error', 'Could not open YouTube.'),
                      );
                    }}
                  >
                    <Text style={styles.ytLinkText} numberOfLines={1}>
                      📺 Latest YouTube{(match.streamCount || 0) > 1 ? ` · ${match.streamCount} saves` : ''} →
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
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
            setScoreInfo(null);
            setDayDrafts({});
          }}
        >
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
        {boardDay != null ? (
          <BoardScoreModal
            key={boardDay}
            visible
            dayNumber={boardDay}
            target={scoreInfo?.target}
            initialBoards={boardsFromSaved((scoreInfo?.scores || []).find((s: any) => s.dayNumber === boardDay))}
            busy={savingDay === boardDay}
            editNote={SCORE_EDIT_PLAYER_HELP}
            onClose={() => setBoardDay(null)}
            onSave={(boards) => void saveBoards(boardDay, boards)}
          />
        ) : null}
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

        <TabBar
          active="combis"
          onMatches={() => setScreen('matches')}
          onCombis={() => setScreen('combis')}
          onStandings={() => setScreen('standings')}
          onScores={() => {
            setScreen('scores');
            if (token) void loadScores(token);
          }}
          onVideos={() => {
            setScreen('videos');
            if (token) void loadVideos(token, { player: videoPlayerFilter, day: videoDayFilter });
          }}
        />

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
                <Text style={styles.combiTapHint}>Tap a player name to find their YouTube videos for this day</Text>
                {(activeDay.events || []).map((evt) => {
                  const fmt = (evt.format || evt.name || '').toUpperCase();
                  const isDoubles = fmt.includes('DOUBLE');
                  const isTriples = fmt.includes('TRIPLE');
                  return (
                    <View key={evt.index} style={styles.combiEventRow}>
                      {renderTappablePlayers(evt.myPlayers, activeDay.dayNumber, 'left')}
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
                      {renderTappablePlayers(evt.opponentPlayers, activeDay.dayNumber, 'right')}
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
            setVideos([]);
            setMyTeam(null);
          }}
        >
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (screen === 'standings') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <TabBar
          active="standings"
          onMatches={() => setScreen('matches')}
          onCombis={() => setScreen('combis')}
          onStandings={() => setScreen('standings')}
          onScores={() => {
            setScreen('scores');
            if (token) void loadScores(token);
          }}
          onVideos={() => {
            setScreen('videos');
            if (token) void loadVideos(token);
          }}
        />
        <StandingsScreen embedded />
      </SafeAreaView>
    );
  }

  if (screen === 'scores') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>DAY SCORE</Text>
            <Text style={styles.headerSubtitle}>
              Players until 8:00pm IST · captains until 9:30pm IST · organiser anytime
            </Text>
          </View>
        </View>
        <TabBar
          active="scores"
          onMatches={() => setScreen('matches')}
          onCombis={() => setScreen('combis')}
          onStandings={() => setScreen('standings')}
          onScores={() => setScreen('scores')}
          onVideos={() => {
            setScreen('videos');
            if (token) void loadVideos(token);
          }}
        />
        <ScrollView style={styles.matchList} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {scoreInfo?.editionStats ? (
            <View style={styles.scoreStatsRow}>
              <View style={styles.scoreStatBox}>
                <Text style={styles.scoreStatNum}>{scoreInfo.editionStats.wins ?? 0}</Text>
                <Text style={styles.scoreStatLabel}>WINS</Text>
              </View>
              <View style={styles.scoreStatBox}>
                <Text style={styles.scoreStatNum}>{scoreInfo.editionStats.slams ?? 0}</Text>
                <Text style={styles.scoreStatLabel}>SLAMS</Text>
              </View>
              <View style={styles.scoreStatBox}>
                <Text style={styles.scoreStatNum}>{scoreInfo.editionStats.averageBonuses ?? 0}</Text>
                <Text style={styles.scoreStatLabel}>TGT BONUS</Text>
              </View>
            </View>
          ) : null}
          <ScoreEditBanner forCaptain={teamRows.length > 0} />
          <Text style={styles.headerSubtitle}>Pick a day, then enter each board in the popup.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {Array.from({ length: Math.max(1, Number(scoreInfo?.maxDay) || 1) }, (_, i) => i + 1).map((d) => {
              const on = scoreDay === d;
              const open = dayWindowOpen(scoreInfo, d);
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => {
                    setScoreDay(d);
                    if (token) void loadScores(token, d);
                  }}
                  style={[styles.tabBtn, on && styles.tabBtnActive, !open && { opacity: 0.55 }]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextActive]}>DAY {d}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {(scoreInfo?.scores || []).map((s: any) => {
            const st = parseBoardDrafts(boardsFromSaved(s));
            const bonus = targetBonus(st.boardCount ? st.total : null, scoreInfo?.target);
            return (
              <Text key={s.dayNumber} style={styles.tabText}>
                Day {s.dayNumber}: {st.total} ({st.boardCount} boards, avg {st.average ?? '—'})
                {bonus === true ? ' · bonus Yes' : ''}
              </Text>
            );
          })}
          {!dayWindowOpen(scoreInfo, scoreInfo?.eligibleDay || scoreDay) ? (
            <Text style={styles.tabText}>{dayWindowReason(scoreInfo, scoreInfo?.eligibleDay || scoreDay)}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.loginButton}
            disabled={scoreBusy || !dayWindowOpen(scoreInfo, scoreDay || scoreInfo?.eligibleDay)}
            onPress={() => setBoardDay(scoreDay || scoreInfo?.eligibleDay || 1)}
          >
            <Text style={styles.loginButtonText}>
              {dayWindowOpen(scoreInfo, scoreDay || scoreInfo?.eligibleDay) ? 'ENTER BOARDS' : 'WINDOW CLOSED'}
            </Text>
          </TouchableOpacity>
          {teamRows.length > 0 ? (
            <View style={{ marginTop: 12, gap: 10 }}>
              <Text style={styles.headerSubtitle}>{SCORE_EDIT_CAPTAIN_HELP}</Text>
              {teamRows.map((row) => {
                const teamOpen = scoreInfo?.teamScoreWindowOpen !== false;
                const stats = parseBoardDrafts(boardsFromSaved({
                  dayNumber: scoreDay,
                  score: row.score === '' ? undefined : Number(row.score),
                  slams: Number(row.slams) || 0,
                  boards: row.boards,
                }));
                const bonus = targetBonus(stats.boardCount ? stats.total : null, row.target);
                const tgt = Number(row.target) || 0;
                const bonusLabel = stats.boardCount === 0 ? 'bonus —' : bonus === true ? 'bonus Yes' : tgt > 0 ? 'bonus No' : 'bonus —';
                return (
                <View key={row.userId} style={styles.teamScoreRow}>
                  <Text style={styles.tabText}>
                    {row.name}
                    {row.missingPrior ? ' · needs earlier day' : stats.boardCount ? ` · ${stats.total} (${stats.boardCount} boards, avg ${stats.average})` : ' · empty'}
                    {' · '}
                    {bonusLabel}
                  </Text>
                  <Text style={styles.cardScoreHint}>Target {tgt > 0 ? tgt : '0 (no bonus)'}</Text>
                  {teamOpen && !row.missingPrior ? (
                    <TouchableOpacity
                      style={styles.cardScoreSave}
                      disabled={teamBusy}
                      onPress={() =>
                        setTeamBoardPlayer({
                          userId: row.userId,
                          name: row.name,
                          target: row.target,
                          boards: row.boards,
                          score: row.score === '' ? undefined : Number(row.score),
                          slams: Number(row.slams) || 0,
                        })
                      }
                    >
                      <Text style={styles.cardScoreSaveText}>
                        {stats.boardCount ? 'UPDATE BOARDS' : 'ENTER BOARDS'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.cardScoreHint}>
                      {row.missingPrior ? 'Organiser must fill the earlier day first.' : SCORE_EDIT_CAPTAIN_CLOSED}
                    </Text>
                  )}
                </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
        {teamBoardPlayer ? (
          <BoardScoreModal
            key={`team-${teamBoardPlayer.userId}-${scoreDay}`}
            visible
            dayNumber={scoreDay || scoreInfo?.teamDayNumber || 1}
            playerName={teamBoardPlayer.name}
            target={teamBoardPlayer.target}
            initialBoards={boardsFromSaved({
              dayNumber: scoreDay,
              score: teamBoardPlayer.score,
              slams: teamBoardPlayer.slams,
              boards: teamBoardPlayer.boards,
            })}
            busy={teamBusy}
            editNote={SCORE_EDIT_CAPTAIN_HELP}
            onClose={() => setTeamBoardPlayer(null)}
            onSave={(boards) => void saveTeamBoards(teamBoardPlayer.userId, teamBoardPlayer.name, boards)}
          />
        ) : boardDay != null ? (
          <BoardScoreModal
            key={`score-${boardDay}`}
            visible
            dayNumber={boardDay}
            target={scoreInfo?.target}
            initialBoards={boardsFromSaved((scoreInfo?.scores || []).find((s: any) => s.dayNumber === boardDay))}
            busy={savingDay === boardDay}
            editNote={SCORE_EDIT_PLAYER_HELP}
            onClose={() => setBoardDay(null)}
            onSave={(boards) => void saveBoards(boardDay, boards)}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  // ==========================================
  if (screen === 'videos') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>📺 CHANNEL VIDEOS</Text>
            <Text style={styles.headerSubtitle}>
              Search by player name or day · tap to watch on YouTube
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerRefreshBtn}
            onPress={() => token && loadVideos(token, { player: videoPlayerFilter, day: videoDayFilter })}
          >
            <Text style={styles.headerRefreshText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        <TabBar
          active="videos"
          onMatches={() => setScreen('matches')}
          onCombis={() => setScreen('combis')}
          onStandings={() => setScreen('standings')}
          onScores={() => {
            setScreen('scores');
            if (token) void loadScores(token);
          }}
          onVideos={() => setScreen('videos')}
        />

        <View style={styles.videoSearchRow}>
          <View style={styles.videoSearchField}>
            <TextInput
              style={styles.videoSearchInput}
              placeholder="Player name"
              placeholderTextColor="#64748b"
              value={videoSearchDraft}
              onChangeText={(v) => {
                setVideoSearchDraft(v);
                if (!v.trim()) applyVideoQuery('', videoDayDraft);
              }}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={() => applyVideoQuery(videoSearchDraft, videoDayDraft)}
            />
            {videoSearchDraft ? (
              <TouchableOpacity
                style={styles.videoClearX}
                onPress={() => {
                  setVideoSearchDraft('');
                  applyVideoQuery('', videoDayDraft);
                }}
                accessibilityLabel="Clear player name"
              >
                <Text style={styles.videoClearXText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.videoSearchField}>
            <TextInput
              style={styles.videoSearchInput}
              placeholder="Day"
              placeholderTextColor="#64748b"
              value={videoDayDraft}
              onChangeText={(v) => {
                const next = v.replace(/[^\d]/g, '').slice(0, 2);
                setVideoDayDraft(next);
                if (!next) applyVideoQuery(videoSearchDraft, '');
              }}
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={() => applyVideoQuery(videoSearchDraft, videoDayDraft)}
            />
            {videoDayDraft ? (
              <TouchableOpacity
                style={styles.videoClearX}
                onPress={() => {
                  setVideoDayDraft('');
                  applyVideoQuery(videoSearchDraft, '');
                }}
                accessibilityLabel="Clear day"
              >
                <Text style={styles.videoClearXText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.videoSearchBtn}
            onPress={() => applyVideoQuery(videoSearchDraft, videoDayDraft)}
          >
            <Text style={styles.videoSearchBtnText}>SEARCH</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.matchList} showsVerticalScrollIndicator={false}>
          {videosLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#f59e0b" />
              <Text style={styles.emptySubtext}>Loading YouTube videos…</Text>
            </View>
          ) : videos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={styles.emptyText}>No videos found</Text>
              <Text style={styles.emptySubtext}>
                Try another player name or day. Videos appear after players go live on the CBOT channel.
              </Text>
            </View>
          ) : (
            videos.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.videoCard, v.isLive && styles.videoCardLive]}
                activeOpacity={0.85}
                onPress={() => {
                  if (!v.youtubeUrl) {
                    Alert.alert('Video', 'YouTube link not available yet for this stream.');
                    return;
                  }
                  Linking.openURL(v.youtubeUrl).catch(() =>
                    Alert.alert('Error', 'Could not open YouTube.'),
                  );
                }}
              >
                <View style={styles.videoThumbWrap}>
                  {v.thumbnailUrl ? (
                    <Image source={{ uri: v.thumbnailUrl }} style={styles.videoThumb} />
                  ) : (
                    <View style={[styles.videoThumb, styles.videoThumbFallback]}>
                      <Text style={styles.videoThumbEmoji}>▶️</Text>
                    </View>
                  )}
                  {v.isLive ? (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.videoMeta}>
                  <Text style={styles.videoPlayerName} numberOfLines={1}>{v.playerName}</Text>
                  <Text style={styles.videoTeamLine} numberOfLines={1}>
                    {v.teamName} · Day {v.dayNumber || '?'}
                  </Text>
                  <Text style={styles.videoWatchHint}>Tap to watch on YouTube →</Text>
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
            setCombiDays([]);
            setVideos([]);
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
  scoreStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreStatBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreStatNum: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
  },
  scoreStatLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  teamScoreRow: {
    gap: 6,
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
  goLiveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  cardScoreBox: {
    marginTop: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardScoreTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1.2,
  },
  cardScoreInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  cardScoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardScoreInput: {
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
  cardScoreSave: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cardScoreSaveText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardScoreHint: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  cardScoreLocked: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '800',
  },
  ytLinkRow: {
    marginTop: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  ytLinkText: {
    color: '#fca5a5',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
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
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
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
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.2,
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
  combiTapHint: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
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
  combiPlayersWrapLeft: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 6,
    gap: 2,
  },
  combiPlayersWrapRight: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 6,
    gap: 2,
  },
  combiPlayerLink: {
    color: '#fbbf24',
    textDecorationLine: 'underline',
    flex: 0,
    paddingRight: 0,
    paddingLeft: 0,
  },
  videoSearchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  videoSearchField: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  videoSearchInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingRight: 32,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  videoClearX: {
    position: 'absolute',
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoClearXText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: -1,
  },
  videoSearchBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  videoSearchBtnText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 10,
  },
  activeFilterText: {
    flex: 1,
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  clearFilterText: {
    color: '#f59e0b',
    fontWeight: '800',
    fontSize: 11,
  },
  videoCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    marginBottom: 10,
  },
  videoCardLive: {
    borderColor: '#ef4444',
  },
  videoThumbWrap: {
    width: 120,
    height: 78,
    backgroundColor: '#020617',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  videoThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbEmoji: {
    fontSize: 22,
  },
  liveBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#ef4444',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  videoMeta: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  videoPlayerName: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 14,
  },
  videoTeamLine: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  videoWatchHint: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
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
