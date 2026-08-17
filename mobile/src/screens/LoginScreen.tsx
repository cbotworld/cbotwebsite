import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { loginPlayer } from '../api/website';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    if (!username.trim() || !pin.trim()) {
      setError('Enter your username and 4-digit PIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginPlayer(username.trim(), pin.trim());
      navigation.replace('Dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>CBOT</Text>
          <Text style={styles.appSubtitle}>PLAYER LIVE</Text>
        </View>

        <Text style={styles.hint}>Use the same username and PIN as the CBOT website.</Text>

        <Text style={styles.label}>USERNAME</Text>
        <TextInput
          style={styles.input}
          placeholder="your username"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>4-DIGIT PIN</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter PIN"
          placeholderTextColor="#64748b"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={onLogin} disabled={busy}>
          {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>SIGN IN</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 28 },
  logoText: { fontSize: 34, fontWeight: '900', color: '#f59e0b', letterSpacing: 4 },
  appSubtitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 4, marginTop: 4 },
  hint: { color: '#94a3b8', textAlign: 'center', marginBottom: 20, fontSize: 13 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 2, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f1f5f9',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 2 },
  error: { color: '#fca5a5', marginTop: 12, textAlign: 'center' },
});
