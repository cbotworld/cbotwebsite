import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export function UpdateAppModal({
  visible,
  currentVersion,
  latestVersion,
  storeUrl,
  platform = Platform.OS,
  onLater,
}: {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
  platform?: string;
  onLater: () => void;
}) {
  const isIos = platform === 'ios';
  const platformName = isIos ? 'APP STORE' : 'GOOGLE PLAY';

  const openStore = async () => {
    const market = isIos
      ? storeUrl
      : 'market://details?id=com.cbotworld';
    try {
      if (!isIos) {
        const can = await Linking.canOpenURL(market);
        if (can) {
          await Linking.openURL(market);
          return;
        }
      }
      await Linking.openURL(storeUrl);
    } catch {
      await Linking.openURL(storeUrl).catch(() => undefined);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{platformName} UPDATE AVAILABLE</Text>
          <Text style={styles.title}>Update Cbot App</Text>
          <Text style={styles.body}>
            A new version ({latestVersion}) is available on {isIos ? 'the App Store / TestFlight' : 'Google Play'}. You currently have {currentVersion}. Update now to get the latest features, streaming, and match schedules.
          </Text>
          <Pressable style={styles.primary} onPress={() => void openStore()}>
            <Text style={styles.primaryText}>UPDATE APP NOW</Text>
          </Pressable>
          <Pressable style={styles.later} onPress={onLater}>
            <Text style={styles.laterText}>DOWNLOAD LATER</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    padding: 22,
  },
  kicker: { color: '#f59e0b', fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  title: { color: '#f8fafc', fontWeight: '900', fontSize: 22, marginTop: 6 },
  body: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 18 },
  primary: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#0f172a', fontWeight: '900', letterSpacing: 0.8 },
  later: { alignItems: 'center', paddingVertical: 12 },
  laterText: { color: '#94a3b8', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
});
