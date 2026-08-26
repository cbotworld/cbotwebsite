import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export function FeedbackRateModal({
  visible,
  busy,
  needsFeedback,
  needsRating,
  onSubmitFeedback,
  onRatePlayStore,
  onLater,
}: {
  visible: boolean;
  busy?: boolean;
  needsFeedback: boolean;
  needsRating: boolean;
  onSubmitFeedback: (message: string) => void;
  onRatePlayStore: () => void;
  onLater: () => void;
}) {
  const [message, setMessage] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.kicker}>STREAM ENDED</Text>
          <Text style={styles.title}>How was Cbot today?</Text>
          <Text style={styles.body}>
            {needsFeedback
              ? 'Leave a short note for the organisers. If you have not rated Cbot on Google Play yet, please do that too.'
              : 'Please rate Cbot on Google Play. It helps other players find the app.'}
          </Text>
          {needsFeedback ? (
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Your feedback"
              placeholderTextColor="#64748b"
              multiline
              textAlignVertical="top"
            />
          ) : null}
          {needsFeedback ? (
            <Pressable
              style={[styles.primary, busy && { opacity: 0.55 }]}
              disabled={busy}
              onPress={() => onSubmitFeedback(message.trim())}
            >
              {busy ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.primaryText}>SEND FEEDBACK</Text>
              )}
            </Pressable>
          ) : null}
          {needsRating ? (
            <Pressable style={styles.secondary} onPress={onRatePlayStore} disabled={busy}>
              <Text style={styles.secondaryText}>RATE ON GOOGLE PLAY</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.later} onPress={onLater} disabled={busy}>
            <Text style={styles.laterText}>NOT NOW</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    padding: 22,
  },
  kicker: { color: '#f59e0b', fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  title: { color: '#f8fafc', fontWeight: '900', fontSize: 22, marginTop: 6 },
  body: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 14 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    color: '#f8fafc',
    padding: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  primary: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryText: { color: '#0f172a', fontWeight: '900', letterSpacing: 0.8 },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#f59e0b', fontWeight: '900', letterSpacing: 0.6 },
  later: { alignItems: 'center', paddingVertical: 12 },
  laterText: { color: '#94a3b8', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
});
