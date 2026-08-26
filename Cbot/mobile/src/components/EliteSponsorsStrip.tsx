import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchEliteSponsors,
  type EliteSponsor,
  type EliteSponsorsPayload,
} from '../api/website';

const ACCENT: Record<EliteSponsor['accent'], string> = {
  emerald: '#34d399',
  rose: '#fb7185',
  sky: '#38bdf8',
  amber: '#f59e0b',
};

export function EliteSponsorsStrip() {
  const [payload, setPayload] = useState<EliteSponsorsPayload | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchEliteSponsors()
        .then((data) => {
          if (!cancelled) setPayload(data);
        })
        .catch(() => {
          if (!cancelled) setPayload(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const sponsors = payload?.eliteSponsors?.filter((s) => s.logoUrl) || [];
  if (!sponsors.length) return null;

  const kicker = (payload?.sectionBadge || 'Official Elite Sponsors').replace(/[💎]/g, '').trim();

  const onPressSponsor = (sponsor: EliteSponsor) => {
    if (sponsor.posterUrl) {
      setPosterUrl(sponsor.posterUrl);
      return;
    }
    if (sponsor.websiteUrl) {
      void Linking.openURL(sponsor.websiteUrl);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>
      <View style={styles.row}>
        {sponsors.map((sponsor) => {
          const color = ACCENT[sponsor.accent] || ACCENT.emerald;
          const round = sponsor.layout === 'round';
          return (
            <Pressable
              key={sponsor.id || sponsor.name}
              style={styles.item}
              onPress={() => onPressSponsor(sponsor)}
            >
              <View
                style={[
                  styles.logoFrame,
                  round ? styles.logoRound : styles.logoRect,
                  { borderColor: color },
                ]}
              >
                <Image
                  source={{ uri: sponsor.logoUrl }}
                  style={[styles.logo, round && styles.logoImgRound]}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.name, { color }]} numberOfLines={2}>
                {sponsor.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Modal visible={Boolean(posterUrl)} transparent animationType="fade" onRequestClose={() => setPosterUrl(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPosterUrl(null)}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="contain" />
          ) : null}
          <Text style={styles.closeHint}>TAP TO CLOSE</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: 'rgba(16,185,129,0.05)',
  },
  kicker: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    gap: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  logoFrame: {
    backgroundColor: '#020617',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoRound: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
  },
  logoRect: {
    width: 72,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    backgroundColor: '#fff',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoImgRound: {
    borderRadius: 24,
  },
  name: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  poster: {
    width: '100%',
    height: '78%',
  },
  closeHint: {
    marginTop: 16,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 11,
  },
});
