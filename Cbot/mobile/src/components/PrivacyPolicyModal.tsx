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
  const openUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.error('Failed to open URL:', url, e);
    }
  };

  const openWebPolicy = () => openUrl(`${config.websiteBaseUrl}/privacy`);
  const openYouTubeTerms = () => openUrl('https://www.youtube.com/t/terms');
  const openGooglePrivacy = () => openUrl('http://www.google.com/policies/privacy');
  const openGooglePermissions = () => openUrl('https://security.google.com/settings/security/permissions');
  const openEmail = () => openUrl('mailto:cbotworld@gmail.com');

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
                Carrom Balu Online Tournament (CBOT) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and process your personal information and data accessed through third-party services across our website, platform, and mobile applications.
              </Text>
            </View>

            {/* Section 1 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Information We Collect</Text>
              <Text style={styles.paragraph}>
                We collect player profile information (name, username, email, WhatsApp phone number, and location) solely to manage tournament registrations, standings, schedules, leaderboard rankings, and match communication.
              </Text>
            </View>

            {/* Section 2 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. YouTube API Services & Integration</Text>
              <Text style={styles.paragraph}>
                Our application uses <Text style={styles.bold}>YouTube API Services</Text> to facilitate tournament live streaming, generate official match broadcasts, verify fair-play match gameplay, and archive match recordings.
              </Text>
              <Text style={styles.paragraph}>
                By using these features and our application, you acknowledge and agree that you are also bound by the{' '}
                <Text style={styles.linkText} onPress={openYouTubeTerms}>
                  YouTube Terms of Service
                </Text>
                .
              </Text>
              <Text style={styles.paragraph}>
                For more information about how Google collects and uses your data, please review the{' '}
                <Text style={styles.linkText} onPress={openGooglePrivacy}>
                  Google Privacy Policy
                </Text>
                .
              </Text>
            </View>

            {/* Section 3 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. YouTube Data Access, Storage & Deletion</Text>
              <Text style={styles.paragraph}>
                When organizers and authorized tournament creators connect YouTube, our application accesses YouTube broadcast and stream metadata (such as broadcast title, live stream status, RTMP ingestion URL, stream keys, and video IDs) solely to initialize match streams and display live video feeds to viewers.
              </Text>
              <Text style={styles.bullet}>
                • <Text style={styles.bold}>Data Storage:</Text> We do not store sensitive private Google credentials permanently. OAuth tokens are stored in an encrypted database strictly for the duration of the tournament broadcast session.
              </Text>
              <Text style={styles.bullet}>
                • <Text style={styles.bold}>Data Retention & Deletion:</Text> Broadcast identifiers are retained only as long as required for tournament record-keeping. You may request immediate deletion of any associated account data or stored video records at any time by contacting{' '}
                <Text style={styles.linkText} onPress={openEmail}>
                  cbotworld@gmail.com
                </Text>
                .
              </Text>
            </View>

            {/* Section 4 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Revocation of Access to Google & YouTube Data</Text>
              <Text style={styles.paragraph}>
                You can revoke our application's access to your Google and YouTube account data at any time via the official{' '}
                <Text style={styles.linkText} onPress={openGooglePermissions}>
                  Google Security Settings Permissions Page
                </Text>
                .
              </Text>
            </View>

            {/* Section 5 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Data Protection & Sharing</Text>
              <Text style={styles.paragraph}>
                We guarantee that your personal information is stored securely and is <Text style={styles.bold}>never shared, sold, or rented</Text> to third-party advertisers, data brokers, or external commercial organizations.
              </Text>
            </View>

            {/* Section 6 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>6. Account Deletion & Data Rights</Text>
              <Text style={styles.paragraph}>
                You have full control over your data. You can delete your account directly at any time inside the mobile application via <Text style={styles.bold}>Profile → Delete Account</Text> or by contacting us via email.
              </Text>
              <Text style={styles.paragraph}>
                Account deletion is immediate and permanent: your profile, login credentials, match scores, statistics, and tournament history are erased completely from our database.
              </Text>
            </View>

            {/* Section 7 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7. Contact Us</Text>
              <Text style={styles.paragraph}>
                If you have any questions about this Privacy Policy, YouTube API data handling, or wish to delete your account, please email us directly at:
              </Text>
              <Pressable onPress={openEmail} style={styles.contactRow}>
                <Text style={styles.contactItem}>📧 Email: <Text style={styles.goldText}>cbotworld@gmail.com</Text></Text>
              </Pressable>
              <Pressable onPress={openWebPolicy} style={styles.contactRow}>
                <Text style={styles.contactItem}>🌐 Website: <Text style={styles.goldText}>www.cbotworld.com</Text></Text>
              </Pressable>
            </View>

            <Pressable style={styles.webBtn} onPress={openWebPolicy}>
              <Text style={styles.webBtnText}>OPEN FULL POLICY IN BROWSER ↗</Text>
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
    marginBottom: 6,
  },
  bold: {
    fontWeight: '700',
    color: '#f1f5f9',
  },
  linkText: {
    color: '#f59e0b',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  contactRow: {
    paddingVertical: 2,
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
    textDecorationLine: 'underline',
  },
  webBtn: {
    marginTop: 14,
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
