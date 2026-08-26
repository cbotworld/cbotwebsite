import { StyleSheet, Text, View } from 'react-native';
import {
  SCORE_EDIT_CAPTAIN_HELP,
  SCORE_EDIT_PLAYER_HELP,
  SCORE_EDIT_RULES,
  SCORE_EDIT_RULES_TITLE,
} from '../score-edit-policy';

export function ScoreEditBanner({ forCaptain }: { forCaptain?: boolean }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{SCORE_EDIT_RULES_TITLE}</Text>
      {SCORE_EDIT_RULES.map((line) => (
        <Text key={line} style={styles.line}>
          • {line}
        </Text>
      ))}
      <Text style={styles.note}>{forCaptain ? SCORE_EDIT_CAPTAIN_HELP : SCORE_EDIT_PLAYER_HELP}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  title: { color: '#f59e0b', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  line: { color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  note: { color: '#e2e8f0', fontWeight: '600', fontSize: 11, marginTop: 4, lineHeight: 16 },
});
