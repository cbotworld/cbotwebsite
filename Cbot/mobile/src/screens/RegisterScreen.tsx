import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { config } from '../config';
import { RootStackParamList } from '../navigation/types';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { sendEmailOtp, verifyEmailOtp } from '../api/website';

const logo = require('../../assets/logo.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Form, 2: OTP, 3: Success
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otp, setOtp] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const [creds, setCreds] = useState<{ username: string; pin: string } | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOtp = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be a 4-digit number.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN and Confirm PIN do not match.');
      return;
    }

    setBusy(true);
    try {
      await sendEmailOtp(email.trim(), name.trim());
      setStep(2);
      setResendTimer(60);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Enter the 6-digit OTP code sent to your email.');
      return;
    }

    setBusy(true);
    try {
      const data = await verifyEmailOtp({
        email: email.trim(),
        otp: otp.trim(),
        name: name.trim(),
        mobile: mobile.trim(),
        pin,
      });

      setCreds({ username: data.username, pin: data.pin || pin });
      setStep(3);

      // Register push token
      void registerForPushNotificationsAsync();
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={logo} style={styles.logo} />
          <Text style={styles.title}>
            {step === 3 ? 'Account Created!' : step === 2 ? 'Verify Email OTP' : 'Create CBOT Account'}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {step === 1 && (
            <View style={styles.form}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Karthik Burra"
                placeholderTextColor="#475569"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Mobile / WhatsApp Number</Text>
              <TextInput
                style={styles.input}
                value={mobile}
                onChangeText={setMobile}
                placeholder="e.g. +91 9876543210"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. player@example.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>4-Digit PIN *</Text>
                  <TextInput
                    style={styles.input}
                    value={pin}
                    onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
                    placeholder="••••"
                    placeholderTextColor="#475569"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                  />
                </View>

                <View style={styles.half}>
                  <Text style={styles.label}>Confirm PIN *</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPin}
                    onChangeText={(v) => setConfirmPin(v.replace(/\D/g, ''))}
                    placeholder="••••"
                    placeholderTextColor="#475569"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.btn, busy && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.btnText}>SEND VERIFICATION OTP</Text>
                )}
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
                <Text style={styles.linkText}>
                  Already have an account? <Text style={styles.linkBold}>Log In</Text>
                </Text>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <Text style={styles.sub}>
                A 6-digit verification code has been sent to <Text style={styles.white}>{email}</Text>.
              </Text>

              <Text style={styles.label}>Enter 6-Digit Email OTP *</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
                placeholder="000000"
                placeholderTextColor="#475569"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <Pressable
                style={[styles.btn, busy && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.btnText}>VERIFY OTP & CREATE ACCOUNT</Text>
                )}
              </Pressable>

              <Pressable onPress={() => setStep(1)} style={styles.backWrap}>
                <Text style={styles.backText}>← Edit Registration Details</Text>
              </Pressable>
            </View>
          )}

          {step === 3 && creds && (
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={styles.successTitle}>Welcome to CBOT!</Text>
              <Text style={styles.successSub}>
                Your account is verified! A copy of your credentials has been emailed to{' '}
                <Text style={styles.white}>{email}</Text>.
              </Text>

              <View style={styles.credsBox}>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>Username:</Text>
                  <Text style={styles.credValueAmber}>{creds.username}</Text>
                </View>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>Security PIN:</Text>
                  <Text style={styles.credValueGreen}>{creds.pin}</Text>
                </View>
              </View>

              <Pressable
                style={styles.btn}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
              >
                <Text style={styles.btnText}>PROCEED TO LOGIN</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  flex: { flex: 1 },
  content: { padding: 24, alignItems: 'center' },
  logo: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 12 },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '900', marginBottom: 16 },
  sub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  white: { color: '#fff', fontWeight: '700' },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  form: { width: '100%' },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 10, color: '#f8fafc', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  otpInput: { fontSize: 24, fontWeight: '900', letterSpacing: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  btn: { backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#0f172a', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  linkWrap: { alignItems: 'center', marginTop: 18 },
  linkText: { color: '#64748b', fontSize: 12 },
  linkBold: { color: '#f59e0b', fontWeight: '700' },
  backWrap: { alignItems: 'center', marginTop: 16 },
  backText: { color: '#94a3b8', fontSize: 12, textDecorationLine: 'underline' },
  successBox: { width: '100%', alignItems: 'center', paddingVertical: 12 },
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  successSub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  credsBox: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 16, width: '100%', marginBottom: 24 },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  credLabel: { color: '#94a3b8', fontSize: 13 },
  credValueAmber: { color: '#f59e0b', fontSize: 15, fontWeight: '900' },
  credValueGreen: { color: '#22c55e', fontSize: 15, fontWeight: '900' },
});
