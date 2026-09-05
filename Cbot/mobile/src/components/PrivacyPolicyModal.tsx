import React from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { config } from '../config';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ visible, onClose }: Props) {
  const openWebPolicy = async () => {
    try {
      const url = `${config.websiteBaseUrl}/privacy`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.error('Failed to open privacy policy URL:', e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>CBOT LEGAL</Text>
              <Text style={styles.title}>Privacy Policy</Text>
              <Text style={styles.sub}>Last Updated: August 2026</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Scrollable Policy Body */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.introCard}>
              <Text style={styles.introText}>
                Carrom BALU Online Tournament (CBOT) is committed to protecting your privacy. This policy outlines how we handle player and participant information across our mobile app and platform.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Information We Collect</Text>
              <Text style={styles.paragraph}>
                When you register or use the CBOT Player Live app, we collect:
              </Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Account Info:</Text> Name, username, email address, WhatsApp mobile number, and login PIN.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Player Profile:</Text> Bio, age, gender, city, state, country, and player averages.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Gameplay Data:</Text> Match scores, day scores, target achievements, live stream videos, and team lineups.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Device Tokens:</Text> Push notification tokens to alert you of match schedules and results.</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. How We Use Your Data</Text>
              <Text style={styles.paragraph}>
                We use the collected information exclusively to:
              </Text>
              <Text style={styles.bullet}>• Facilitate fair-play tournament matchups and combis pairings.</Text>
              <Text style={styles.bullet}>• Compute official player grades, averages, targets, and team standings.</Text>
              <Text style={styles.bullet}>• Broadcast and archive verified match streams.</Text>
              <Text style={styles.bullet}>• Distribute match schedule reminders, login PIN updates, and score alerts.</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Data Protection & Sharing</Text>
              <Text style={styles.paragraph}>
                We guarantee that your personal data is stored securely and is <Text style={styles.bold}>never shared, sold, or rented</Text> to third-party sponsors, advertisers, or external organizations.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Account Deletion & Data Rights</Text>
              <Text style={styles.paragraph}>
                You have full control over your data. You can delete your account directly at any time inside the app via <Text style={styles.bold}>Profile → Delete Account</Text>.
              </Text>
              <Text style={styles.paragraph}>
                Account deletion is immediate and permanent: your profile, login credentials, match scores, statistics, and tournament history are erased completely from our database.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Contact & Support</Text>
              <Text style={styles.paragraph}>
                If you have any questions regarding privacy or data practices, please reach out to us:
              </Text>
              <Text style={styles.contactItem}>📧 Email: <Text style={styles.goldText}>cbotworld@gmail.com</Text></Text>
              <Text style={styles.contactItem}>🌐 Website: <Text style={styles.goldText}>www.cbotworld.com</Text></Text>
            </View>

            <Pressable style={styles.webBtn} onPress={openWebPolicy}>
              <Text style={styles.webBtnText}>OPEN IN BROWSER ↗</Text>
            </Pressable>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <Pressable style={styles.dismissBtn} onPress={onClose}>
              <Text style={styles.dismissBtnText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.94)',
    justifyContent: 'center',
    padding: Platform.OS === 'ios' ? 12 : 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 30,
  },
  introCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  introText: {
    color: '#fef3c7',
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 12.5,
    color: '#cbd5e1',
    lineHeight: 19,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginLeft: 4,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
    color: '#f1f5f9',
  },
  contactItem: {
    fontSize: 12.5,
    color: '#cbd5e1',
    lineHeight: 20,
    marginTop: 2,
  },
  goldText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  webBtn: {
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  webBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  dismissBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
