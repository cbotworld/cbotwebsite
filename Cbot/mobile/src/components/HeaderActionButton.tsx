import { Pressable, StyleSheet, Text } from 'react-native';

export function HeaderActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.btn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 12,
  },
});
