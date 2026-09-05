import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginPlayer } from '../api/website';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { RootStackParamList } from '../navigation/types';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';

const logo = require('../../assets/logo.png');
const PIN_LENGTH = 4;

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pinFocus, setPinFocus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const pinRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const setPinDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 1) {
      const next = digits.slice(0, PIN_LENGTH);
      setPin(next);
      pinRefs.current[Math.min(next.length, PIN_LENGTH - 1)]?.focus();
      return;
    }

    if (!digits) {
      const chars = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');
      chars[index] = '';
      setPin(chars.join('').replace(/\s/g, ''));
      return;
    }

    const chars = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');
    chars[index] = digits.slice(-1);
    const next = chars.join('').replace(/\s/g, '').slice(0, PIN_LENGTH);
    setPin(next);
    if (index < PIN_LENGTH - 1) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const onPinKeyPress = (index: number, key: string) => {
    if (key !== 'Backspace') return;
    if (pin[index]) {
      const chars = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');
      chars[index] = '';
      setPin(chars.join('').replace(/\s/g, ''));
      return;
    }
    if (index > 0) {
      const chars = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');
      chars[index - 1] = '';
      setPin(chars.join('').replace(/\s/g, ''));
      pinRefs.current[index - 1]?.focus();
    }
  };

  const onLogin = async () => {
    if (!username.trim() || pin.length !== PIN_LENGTH) {
      setError('Enter your username and 4-digit PIN.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginPlayer(username.trim(), pin);
      void registerForPushNotificationsAsync();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.logoContainer}>
            <Image
              source={logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Carrom BALU Online Tournament"
            />
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
            onFocus={scrollToInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pinRefs.current[Math.min(pin.length, PIN_LENGTH - 1)]?.focus()}
          />

          <Text style={styles.label}>4-DIGIT PIN</Text>
          <View style={styles.pinRow}>
            {Array.from({ length: PIN_LENGTH }, (_, index) => {
              const filled = Boolean(pin[index]);
              const focused = pinFocus === index;
              return (
                <TextInput
                  key={index}
                  ref={(node) => {
                    pinRefs.current[index] = node;
                  }}
                  style={[styles.pinBox, filled && styles.pinBoxFilled, focused && styles.pinBoxFocused]}
                  value={pin[index] || ''}
                  onChangeText={(value) => setPinDigit(index, value)}
                  onKeyPress={({ nativeEvent }) => onPinKeyPress(index, nativeEvent.key)}
                  onFocus={() => {
                    setPinFocus(index);
                    scrollToInput();
                  }}
                  onBlur={() => setPinFocus((current) => (current === index ? null : current))}
                  keyboardType="number-pad"
                  maxLength={PIN_LENGTH}
                  selectTextOnFocus
                  textContentType="oneTimeCode"
                  importantForAutofill="no"
                  accessibilityLabel={`PIN digit ${index + 1}`}
                />
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={onLogin} disabled={busy}>
            {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>SIGN IN</Text>}
          </Pressable>

          <Pressable style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLinkText}>
              New Player? <Text style={styles.registerLinkBold}>Create Account</Text>
            </Text>
          </Pressable>

          <Pressable
            style={styles.skip}
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            }}
          >
            <Text style={styles.skipText}>CONTINUE WITHOUT LOGIN</Text>
          </Pressable>

          <Pressable style={styles.privacyLink} onPress={() => setPrivacyOpen(true)}>
            <Text style={styles.privacyLinkText}>
              By signing in, you agree to our{' '}
              <Text style={styles.privacyLinkHighlight}>Privacy Policy</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <PrivacyPolicyModal visible={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  logoContainer: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 188, height: 188, marginBottom: 12, borderRadius: 20 },
  appSubtitle: { fontSize: 11, fontWeight: '800', color: '#d4a5aa', letterSpacing: 4, marginTop: 2 },
  hint: { color: '#cbd5e1', textAlign: 'center', marginBottom: 20, fontSize: 13 },
  label: { fontSize: 10, fontWeight: '800', color: '#f59e0b', letterSpacing: 2, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#2a0408',
    borderWidth: 1,
    borderColor: '#4a0910',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#f1f5f9',
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  pinBox: {
    flex: 1,
    height: 58,
    backgroundColor: '#2a0408',
    borderWidth: 1.5,
    borderColor: '#4a0910',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    padding: 0,
  },
  pinBoxFilled: {
    borderColor: '#7a121c',
  },
  pinBoxFocused: {
    borderColor: '#f59e0b',
    backgroundColor: '#38050a',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 14, fontWeight: '900', color: '#1c0205', letterSpacing: 2 },
  skip: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  skipText: { color: '#d4a5aa', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  registerLink: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  registerLinkText: { color: '#cbd5e1', fontSize: 13 },
  registerLinkBold: { color: '#f59e0b', fontWeight: '800' },
  privacyLink: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  privacyLinkText: { color: '#94a3b8', fontSize: 11.5, textAlign: 'center' },
  privacyLinkHighlight: { color: '#f59e0b', fontWeight: '800', textDecorationLine: 'underline' },
  error: { color: '#fca5a5', marginTop: 12, textAlign: 'center' },
});
