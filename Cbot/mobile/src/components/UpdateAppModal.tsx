import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function UpdateAppModal({
  visible,
  currentVersion,
  latestVersion,
  storeUrl,
  onLater,
}: {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
  onLater: () => void;
}) {
  const openStore = async () => {
    const market = 'market://details?id=com.cbotworld';
    try {
      const can = await Linking.canOpenURL(market);
      await Linking.openURL(can ? market : storeUrl);
    } catch {
      await Linking.openURL(storeUrl).catch(() => undefined);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.kicker}>GOOGLE PLAY</Text>
          <Text style={styles.title}>Update Cbot</Text>
          <Text style={styles.body}>
            Version {latestVersion} is on Google Play. You have {currentVersion}. Update now to get
            the latest matches, scores, and videos.
          </Text>
          <Pressable style={styles.primary} onPress={() => void openStore()}>
            <Text style={styles.primaryText}>UPDATE APP</Text>
          </Pressable>
          <Pressable style={styles.later} onPress={onLater}>
            <Text style={styles.laterText}>LATER</Text>
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
