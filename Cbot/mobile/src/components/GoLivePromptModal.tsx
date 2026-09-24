import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { MatchDetails } from '../api/website';

type Props = {
  visible: boolean;
  match: MatchDetails | null;
  onClose: () => void;
  onConfirmGoLive: () => void;
};

export function GoLivePromptModal({
  visible,
  match,
  onClose,
  onConfirmGoLive,
}: Props) {
  if (!match) return null;

  const rawDescription =
    match.editionDescription?.trim() ||
    match.editionRules?.trim() ||
    match.editionTheme?.trim() ||
    `${match.editionTitle} — Standard match play. Stream your boards continuously until match completion.`;

  // Clean description and extract disclaimer if embedded
  let cleanDescription = rawDescription;
  let customDisclaimer = 'Phone screen will be dimmed for performance reasons - recording is un-interrupted';

  const disclaimerMatch = rawDescription.match(/(?:[\r\n\s_—-]*)Disclaimer:\s*([\s\S]+)$/i);
  if (disclaimerMatch) {
    cleanDescription = rawDescription.replace(/(?:[\r\n\s_—-]*)Disclaimer:\s*[\s\S]+$/i, '').trim();
    if (disclaimerMatch[1]?.trim()) {
      customDisclaimer = disclaimerMatch[1].trim();
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.card}>
          <ScrollView
            style={{ maxHeight: 540 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Badge */}
            <View style={styles.headerBadgeRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.kicker}>READ BEFORE GOING LIVE</Text>
            </View>

            <Text style={styles.editionTitle}>{match.editionTitle}</Text>
            <Text style={styles.matchSub}>
              {match.label} · {match.teamTag || match.teamName} vs {match.opponentTag || match.opponentName}
            </Text>

            {/* Description Card */}
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionHeader}>Description</Text>
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionContent}>{cleanDescription}</Text>
              </View>
            </View>

            {/* Rules / Extra notes if available */}
            {match.editionRules && match.editionRules !== match.editionDescription ? (
              <View style={[styles.descriptionSection, { marginTop: 12 }]}>
                <Text style={styles.descriptionHeader}>Tournament Rules</Text>
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionContent}>{match.editionRules}</Text>
                </View>
              </View>
            ) : null}

            {/* Live Camera Guidelines & Disclaimer Warning Box */}
            <View style={styles.guidelinesBox}>
              <View style={styles.guidelinesList}>
                {/* Point 1 */}
                <View style={styles.guidelineItem}>
                  <Ionicons name="information-circle" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                  <Text style={styles.guidelinesText}>
                    Make sure your phone camera clearly captures the entire carrom board and all pockets during the broadcast.
                  </Text>
                </View>

                {/* Point 2: Disclaimer */}
                <View style={styles.guidelineItem}>
                  <Ionicons name="information-circle" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                  <Text style={styles.guidelinesText}>
                    <Text style={styles.guidelinesBold}>Disclaimer: </Text>
                    {customDisclaimer}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <Pressable
              style={({ pressed }) => [
                styles.goLiveBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={onConfirmGoLive}
            >
              <Text style={styles.goLiveBtnText}>🔴  OK & GO LIVE NOW</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#090d16',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f87171',
    letterSpacing: 1.5,
  },
  editionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 26,
  },
  matchSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
    marginTop: 2,
    marginBottom: 16,
  },
  descriptionSection: {
    marginBottom: 4,
  },
  descriptionHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 6,
  },
  descriptionBox: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  descriptionContent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
    lineHeight: 20,
  },
  guidelinesBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    marginBottom: 18,
  },
  guidelinesList: {
    gap: 10,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guidelinesText: {
    flex: 1,
    fontSize: 12.5,
    color: '#fef3c7',
    lineHeight: 18,
    fontWeight: '500',
  },
  guidelinesBold: {
    fontWeight: '800',
    color: '#fbbf24',
  },
  goLiveBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8,
  },
  goLiveBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
});
