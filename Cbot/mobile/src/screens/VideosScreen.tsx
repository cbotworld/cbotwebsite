import { CompositeNavigationProp, RouteProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderActionButton } from '../components/HeaderActionButton';
import { fetchChannelVideos, type ChannelVideo } from '../api/website';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Videos'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
  route: RouteProp<MainTabParamList, 'Videos'>;
};

function youtubeWatchUrl(video: ChannelVideo): string | null {
  const id = (video.youtubeVideoId || '').trim();
  if (id && !id.startsWith('cbot_yt_') && !id.includes('/')) {
    return `https://www.youtube.com/watch?v=${id}`;
  }
  const raw = (video.youtubeUrl || '').trim();
  if (!raw) return null;
  const embed = raw.match(/youtube\.com\/embed\/([^?&/]+)/i);
  if (embed) return `https://www.youtube.com/watch?v=${embed[1]}`;
  const watch = raw.match(/[?&]v=([^&]+)/i);
  if (watch) return `https://www.youtube.com/watch?v=${watch[1]}`;
  const short = raw.match(/youtu\.be\/([^?&/]+)/i);
  if (short) return `https://www.youtube.com/watch?v=${short[1]}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

export function VideosScreen({ navigation, route }: Props) {
  const [loading, setLoading] = useState(true);
  const [allVideos, setAllVideos] = useState<ChannelVideo[]>([]);
  const [edition, setEdition] = useState<{ title: string; number: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerDraft, setPlayerDraft] = useState(route.params?.player || '');
  const [dayDraft, setDayDraft] = useState(route.params?.day ? String(route.params.day) : '');
  const [playerFilter, setPlayerFilter] = useState(route.params?.player || '');
  const [dayFilter, setDayFilter] = useState<number | 'ALL'>(route.params?.day || 'ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchChannelVideos();
      setAllVideos(res.videos);
      setEdition(
        res.edition?.title || res.edition?.number
          ? { title: res.edition.title || `Edition ${res.edition.number}`, number: res.edition.number }
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load videos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('tabPress', () => {
      setPlayerDraft('');
      setDayDraft('');
      setPlayerFilter('');
      setDayFilter('ALL');
      navigation.setParams({ player: undefined, day: undefined, nonce: undefined });
    });
    return unsub;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const player = route.params?.player;
      const day = route.params?.day;
      if (player) {
        setPlayerDraft(player);
        setPlayerFilter(player);
      }
      if (day) {
        setDayDraft(String(day));
        setDayFilter(day);
      }
      void load();
    }, [load, route.params?.player, route.params?.day, route.params?.nonce]),
  );

  const applySearch = (nextPlayer = playerDraft, nextDay = dayDraft) => {
    const player = nextPlayer.trim();
    const dayRaw = nextDay.trim().replace(/^day\s*/i, '');
    const dayNum = dayRaw ? parseInt(dayRaw, 10) : NaN;
    setPlayerFilter(player);
    setDayFilter(Number.isFinite(dayNum) && dayNum > 0 ? dayNum : 'ALL');
  };

  const videos = allVideos.filter((v) => {
    if (dayFilter !== 'ALL' && v.dayNumber !== dayFilter) return false;
    if (playerFilter.trim()) {
      const q = playerFilter.trim().toLowerCase();
      const hay = `${v.playerName} ${v.playerUsername || ''} ${v.teamName} ${v.title}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const openVideo = async (video: ChannelVideo) => {
    const url = youtubeWatchUrl(video);
    if (!url) {
      Alert.alert('YouTube', 'This video does not have a YouTube link yet.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('YouTube', 'Could not open YouTube. Please try again.');
    }
  };

  const filterLabel = [
    playerFilter.trim() ? `player “${playerFilter.trim()}”` : null,
    dayFilter !== 'ALL' ? `Day ${dayFilter}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>CBOT WORLD</Text>
          <Text style={styles.title}>YouTube videos</Text>
          {edition ? (
            <View style={styles.editionChip} accessibilityRole="text">
              <Text style={styles.editionChipKicker}>CURRENT EDITION</Text>
              <Text style={styles.editionChipTitle} numberOfLines={1}>
                {edition.title}
              </Text>
            </View>
          ) : (
            <View style={styles.editionChip}>
              <Text style={styles.editionChipKicker}>CURRENT EDITION</Text>
              <Text style={styles.editionChipTitle}>This cup only</Text>
            </View>
          )}
          <Text style={styles.sub}>Search stays inside this edition. Past cups are not shown.</Text>
        </View>
        <HeaderActionButton label="Refresh" onPress={() => void load()} />
      </View>

      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Text style={styles.fieldLabel}>PLAYER NAME</Text>
            <View style={styles.searchInputWrap}>
              <TextInput
                style={styles.search}
                placeholder="Player name"
                placeholderTextColor="#64748b"
                value={playerDraft}
                onChangeText={(v) => {
                  setPlayerDraft(v);
                  const q = v.trim();
                  setPlayerFilter(q);
                }}
                onSubmitEditing={() => applySearch()}
                returnKeyType="search"
                autoCapitalize="words"
              />
              {playerDraft ? (
                <Pressable
                  style={styles.clearX}
                  onPress={() => {
                    setPlayerDraft('');
                    setPlayerFilter('');
                  }}
                  hitSlop={8}
                  accessibilityLabel="Clear player name"
                >
                  <Text style={styles.clearXText}>×</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.searchField}>
            <Text style={styles.fieldLabel}>DAY</Text>
            <View style={styles.searchInputWrap}>
              <TextInput
                style={styles.search}
                placeholder="Day"
                placeholderTextColor="#64748b"
                value={dayDraft}
                onChangeText={(v) => {
                  const next = v.replace(/[^\d]/g, '').slice(0, 2);
                  setDayDraft(next);
                  const dayNum = next ? parseInt(next, 10) : NaN;
                  setDayFilter(Number.isFinite(dayNum) && dayNum > 0 ? dayNum : 'ALL');
                }}
                onSubmitEditing={() => applySearch()}
                keyboardType="number-pad"
                returnKeyType="search"
              />
              {dayDraft ? (
                <Pressable
                  style={styles.clearX}
                  onPress={() => {
                    setDayDraft('');
                    setDayFilter('ALL');
                  }}
                  hitSlop={8}
                  accessibilityLabel="Clear day"
                >
                  <Text style={styles.clearXText}>×</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable style={styles.searchBtn} onPress={() => applySearch()}>
          <Text style={styles.searchBtnText}>SEARCH</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#f59e0b" />
          <Text style={styles.muted}>Loading CBOTWORLD videos…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {filterLabel ? (
            <Text style={styles.resultMeta}>
              {videos.length} video{videos.length === 1 ? '' : 's'} · {filterLabel}
            </Text>
          ) : (
            <Text style={styles.resultMeta}>{videos.length} video{videos.length === 1 ? '' : 's'}</Text>
          )}
          {videos.length === 0 ? (
            <Text style={styles.empty}>
              {filterLabel ? `No videos found for ${filterLabel}.` : 'No videos for this edition yet. Check back after matches go live.'}
            </Text>
          ) : null}
          {videos.map((v) => (
            <Pressable
              key={v.id}
              style={[styles.card, v.isLive && styles.cardLive]}
              onPress={() => void openVideo(v)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${v.title} on YouTube`}
            >
              {v.thumbnailUrl ? (
                <Image source={{ uri: v.thumbnailUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={styles.play}>▶</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.metaRow}>
                  {v.isLive ? <Text style={styles.live}>LIVE</Text> : null}
                  {v.dayNumber ? <Text style={styles.dayTag}>DAY {v.dayNumber}</Text> : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {v.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {v.playerName}
                  {v.teamName ? ` · ${v.teamName}` : ''}
                </Text>
                <Text style={styles.watchHint}>WATCH ON YOUTUBE</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
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
    gap: 12,
  },
  filters: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  kicker: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: '900', color: '#f8fafc', marginTop: 2 },
  editionChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  editionChipKicker: {
    fontSize: 9,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1.2,
  },
  editionChipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 1,
  },
  sub: { fontSize: 12, color: '#94a3b8', marginTop: 8, lineHeight: 18 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  searchField: { flex: 1 },
  searchInputWrap: { position: 'relative', justifyContent: 'center' },
  search: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingRight: 36,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 44,
  },
  clearX: {
    position: 'absolute',
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearXText: { color: '#f8fafc', fontSize: 16, fontWeight: '800', lineHeight: 18, marginTop: -1 },
  searchBtn: {
    marginTop: 12,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#0f172a', fontWeight: '900', letterSpacing: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#94a3b8' },
  list: { padding: 14, paddingBottom: 32 },
  resultMeta: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 12 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
  error: { color: '#fca5a5', textAlign: 'center', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardLive: { borderColor: '#ef4444' },
  thumb: { width: 112, height: 72, borderRadius: 10, backgroundColor: '#1e293b' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  play: { color: '#f8fafc', fontSize: 18 },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  live: { color: '#ef4444', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  dayTag: { color: '#f59e0b', fontWeight: '800', fontSize: 10 },
  cardTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 13 },
  cardMeta: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  watchHint: { color: '#f59e0b', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 6 },
});
