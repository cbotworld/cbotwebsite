import { Pressable, StyleSheet, Text, View } from 'react-native';

export function LoginBanner({
  title,
  message,
  onLogin,
}: {
  title: string;
  message: string;
  onLogin: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={styles.btn} onPress={onLogin}>
        <Text style={styles.btnText}>LOG IN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    margin: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  title: { color: '#f8fafc', fontWeight: '900', fontSize: 16, textAlign: 'center' },
  message: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
  },
  btnText: { color: '#0f172a', fontWeight: '900', letterSpacing: 1.4 },
});
