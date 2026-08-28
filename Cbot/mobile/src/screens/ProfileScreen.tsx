import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderActionButton } from '../components/HeaderActionButton';
import { LoginBanner } from '../components/LoginBanner';
import {
  changePin,
  deleteAccount,
  fetchProfile,
  getSession,
  saveProfile,
  setSession,
  type ProfilePayload,
} from '../api/website';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAppDialog } from '../components/AppDialog';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Profile'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

const GENDERS = ['Male', 'Female', 'Other'];

export function ProfileScreen({ navigation }: Props) {
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(
    session
      ? {
          user: session.user,
          team: session.team,
        }
      : null,
  );
  const [form, setForm] = useState({
    bio: session?.user.bio || '',
    address: session?.user.address || '',
    pincode: session?.user.pincode || '',
    city: session?.user.city || '',
    state: session?.user.state || '',
    country: session?.user.country || '',
    whatsApp: session?.user.whatsApp || '',
    email: session?.user.email || '',
    age: session?.user.age != null ? String(session.user.age) : '',
    gender: session?.user.gender || '',
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'form' | 'confirm'>('form');
  const [deleteUsername, setDeleteUsername] = useState('');
  const [deletePin, setDeletePin] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { dialog, showConfirm, showSuccess } = useAppDialog();

  const load = useCallback(async () => {
    if (!getSession()?.token) {
      setLoading(false);
      setProfile(null);
      return;
    }
    setError(null);
    try {
      const data = await fetchProfile();
      setProfile(data);
      const genderValue = data.user.gender || '';
      const genderMatch = GENDERS.find((g) => g.toLowerCase() === genderValue.toLowerCase()) || genderValue;
      setForm({
        bio: data.user.bio || '',
        address: data.user.address || '',
        pincode: data.user.pincode || '',
        city: data.user.city || '',
        state: data.user.state || '',
        country: data.user.country || '',
        whatsApp: data.user.whatsApp || '',
        email: data.user.email || '',
        age: data.user.age != null ? String(data.user.age) : '',
        gender: genderMatch,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const data = await saveProfile({
        bio: form.bio,
        address: form.address,
        pincode: form.pincode,
        city: form.city,
        state: form.state,
        country: form.country,
        whatsApp: form.whatsApp,
        email: form.email,
        age: form.age.trim() ? parseInt(form.age, 10) : null,
        gender: form.gender,
      });
      setProfile(data);
      setOk('Profile saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const closePinModal = () => {
    if (pinBusy) return;
    setPinOpen(false);
    setPinError(null);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const onChangePin = async () => {
    if (!/^\d{4}$/.test(currentPin)) {
      setPinError('Enter your current 4-digit PIN.');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PIN and confirm PIN do not match.');
      return;
    }
    if (currentPin === newPin) {
      setPinError('New PIN must be different from your current PIN.');
      return;
    }
    setPinBusy(true);
    setPinError(null);
    setError(null);
    setOk(null);
    try {
      const message = await changePin(currentPin, newPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setPinOpen(false);
      setOk(message);
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'PIN change failed.');
    } finally {
      setPinBusy(false);
    }
  };

  const logout = () => {
    showConfirm(
      'Sign Out',
      'You will need your username and PIN to sign in again.',
      () => {
        setSession(null);
        navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Main' }] });
      },
      { confirmLabel: 'Sign out', confirmStyle: 'danger', cancelLabel: 'Cancel' },
    );
  };

  const openDeleteModal = () => {
    setDeleteUsername('');
    setDeletePin('');
    setDeleteError(null);
    setDeleteStep('form');
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeleteStep('form');
    setDeleteUsername('');
    setDeletePin('');
    setDeleteError(null);
  };

  const onDeleteProceed = () => {
    const expectedUsername = (user?.username || '').toLowerCase();
    if (!deleteUsername.trim()) {
      setDeleteError('Enter your username.');
      return;
    }
    if (deleteUsername.trim().toLowerCase() !== expectedUsername) {
      setDeleteError('Username does not match your account.');
      return;
    }
    if (!/^\d{4}$/.test(deletePin)) {
      setDeleteError('Enter your 4-digit PIN.');
      return;
    }
    setDeleteError(null);
    setDeleteStep('confirm');
  };

  const onDeleteConfirm = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(deleteUsername.trim(), deletePin);
      setDeleteOpen(false);
      setSession(null);
      showSuccess(
        'Account Deleted',
        'Your account has been permanently deleted.',
        () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Main' }] }),
      );
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed.');
      setDeleteStep('form');
    } finally {
      setDeleteBusy(false);
    }
  };

  const user = profile?.user;
  const team = profile?.team;
  const initials = (user?.name || 'P').replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'P';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>PROFILE</Text>
            <Text style={styles.title}>{user?.name || (getSession()?.token ? 'Player' : 'Guest')}</Text>
            <Text style={styles.sub}>
              {getSession()?.token
                ? `@${user?.username || '—'} · ${user?.role || 'PLAYER'}${team ? ` · ${team.name}` : ''}`
                : 'Browse this page now. Log in to view and edit your profile'}
            </Text>
          </View>
          {getSession()?.token ? (
            <HeaderActionButton label="Refresh" onPress={() => void load()} />
          ) : (
            <HeaderActionButton label="Log in" onPress={() => navigation.getParent()?.navigate('Login')} />
          )}
        </View>

        {loading && !profile ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : !getSession()?.token ? (
          <LoginBanner
            title="Your player profile"
            message="Log in with your CBOT username and PIN to view stats, team, and update your details."
            onLogin={() => navigation.getParent()?.navigate('Login')}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedLabel}>NAME (ORGANIZER SET)</Text>
                <Text style={styles.lockedValue}>{user?.name || '—'}</Text>
                <Text style={[styles.lockedLabel, { marginTop: 8 }]}>USERNAME</Text>
                <Text style={styles.lockedValue}>@{user?.username || '—'}</Text>
              </View>
            </View>

            {profile?.editionStats ? (
              <View style={styles.editionCard}>
                <Text style={styles.lockedLabel}>THIS EDITION</Text>
                <View style={[styles.statsRow, { marginBottom: 0, marginTop: 8 }]}>
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{profile.editionStats.wins}</Text>
                    <Text style={styles.statLbl}>WINS</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{profile.editionStats.slams}</Text>
                    <Text style={styles.statLbl}>SLAMS</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{profile.editionStats.averageBonuses}</Text>
                    <Text style={styles.statLbl}>TGT BONUS</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {team ? (
              <View style={styles.teamCard}>
                {team.logo ? (
                  <Image source={{ uri: team.logo }} style={styles.teamLogo} />
                ) : (
                  <View style={styles.teamBadge}>
                    <Text style={styles.avatarText}>{(team.tag || team.name || 'T').slice(0, 3)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockedLabel}>YOUR TEAM</Text>
                  <Text style={styles.lockedValue}>{team.name}</Text>
                  {team.isCaptain ? <Text style={styles.captainTag}>CAPTAIN</Text> : null}
                </View>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{user?.average ?? 0}</Text>
                <Text style={styles.statLbl}>AVG</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{user?.target ?? 0}</Text>
                <Text style={styles.statLbl}>TARGET</Text>
              </View>
            </View>

            <Text style={styles.section}>YOUR DETAILS</Text>
            <Field label="BIO" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} multiline />
            <Field label="WHATSAPP / PHONE" value={form.whatsApp} onChange={(v) => setForm({ ...form, whatsApp: v })} keyboard="phone-pad" />
            <Field label="EMAIL" value={form.email} onChange={(v) => setForm({ ...form, email: v })} keyboard="email-address" />
            <Field label="FULL ADDRESS" value={form.address} onChange={(v) => setForm({ ...form, address: v })} multiline />
            <Field label="PINCODE" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v.replace(/[^\d]/g, '').slice(0, 6) })} keyboard="number-pad" maxLength={6} />
            <Field label="CITY / TOWN" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="STATE" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            <Field label="COUNTRY" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="AGE" value={form.age} onChange={(v) => setForm({ ...form, age: v.replace(/[^\d]/g, '') })} keyboard="number-pad" />

            <Text style={styles.fieldLabel}>GENDER</Text>
            <View style={styles.row}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  style={[styles.chip, form.gender === g && styles.chipOn]}
                  onPress={() => setForm({ ...form, gender: g })}
                >
                  <Text style={[styles.chipText, form.gender === g && styles.chipTextOn]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {ok ? <Text style={styles.ok}>{ok}</Text> : null}

            <Pressable style={[styles.button, saving && styles.disabled]} onPress={() => void onSave()} disabled={saving}>
              {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>SAVE PROFILE</Text>}
            </Pressable>

            <Text style={styles.section}>SECURITY</Text>
            <Pressable style={styles.secondary} onPress={() => { setPinError(null); setPinOpen(true); }}>
              <Text style={styles.secondaryText}>UPDATE PIN</Text>
            </Pressable>

            <Pressable style={styles.logout} onPress={logout}>
              <Text style={styles.logoutText}>SIGN OUT</Text>
            </Pressable>

            <Text style={styles.section}>DANGER ZONE</Text>
            <Pressable style={styles.deleteBtn} onPress={openDeleteModal}>
              <Text style={styles.deleteBtnText}>DELETE ACCOUNT</Text>
            </Pressable>
            <Text style={styles.deleteHint}>Permanently removes your account, scores, and all data. This cannot be undone.</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* ── Delete Account Modal ── */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={closeDeleteModal}>
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.pinBackdrop} onPress={closeDeleteModal} />
          <View style={styles.pinCard}>
            {deleteStep === 'form' ? (
              <>
                <Text style={[styles.pinKicker, { color: '#ef4444' }]}>DANGER ZONE</Text>
                <Text style={styles.pinTitle}>Delete Account</Text>
                <Text style={styles.pinHint}>
                  This will permanently delete your account and all your scores, stats, and data.{'
'}This cannot be undone.
                </Text>
                <Field
                  label="TYPE YOUR USERNAME"
                  value={deleteUsername}
                  onChange={(v) => setDeleteUsername(v.replace(/\s/g, ''))}
                  keyboard="default"
                />
                <Field
                  label="TYPE YOUR PIN"
                  value={deletePin}
                  onChange={(v) => setDeletePin(v.replace(/[^\d]/g, '').slice(0, 4))}
                  keyboard="number-pad"
                  secure
                  maxLength={4}
                />
                {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
                <Pressable
                  style={[styles.deleteConfirmBtn, deleteBusy && styles.disabled]}
                  onPress={onDeleteProceed}
                  disabled={deleteBusy}
                >
                  <Text style={styles.deleteConfirmBtnText}>CONTINUE →</Text>
                </Pressable>
                <Pressable style={styles.pinCancel} onPress={closeDeleteModal} disabled={deleteBusy}>
                  <Text style={styles.pinCancelText}>CANCEL</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.pinKicker, { color: '#ef4444' }]}>FINAL CONFIRMATION</Text>
                <Text style={styles.pinTitle}>Are you sure?</Text>
                <Text style={styles.pinHint}>
                  You are about to permanently delete{'
'}
                  <Text style={{ color: '#f87171', fontWeight: '900' }}>@{deleteUsername}</Text>.{'
'}
                  All scores, stats, and data will be erased forever.
                </Text>
                {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
                <Pressable
                  style={[styles.deleteConfirmBtn, deleteBusy && styles.disabled]}
                  onPress={() => void onDeleteConfirm()}
                  disabled={deleteBusy}
                >
                  {deleteBusy
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.deleteConfirmBtnText}>YES, DELETE PERMANENTLY</Text>}
                </Pressable>
                <Pressable style={styles.pinCancel} onPress={() => setDeleteStep('form')} disabled={deleteBusy}>
                  <Text style={styles.pinCancelText}>GO BACK</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={pinOpen} transparent animationType="fade" onRequestClose={closePinModal}>
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.pinBackdrop} onPress={closePinModal} />
          <View style={styles.pinCard}>
            <Text style={styles.pinKicker}>SECURITY</Text>
            <Text style={styles.pinTitle}>Update PIN</Text>
            <Text style={styles.pinHint}>Enter your current PIN, then a new 4-digit PIN twice.</Text>
            <Field
              label="CURRENT PIN"
              value={currentPin}
              onChange={(v) => setCurrentPin(v.replace(/[^\d]/g, '').slice(0, 4))}
              keyboard="number-pad"
              secure
              maxLength={4}
            />
            <Field
              label="NEW PIN"
              value={newPin}
              onChange={(v) => setNewPin(v.replace(/[^\d]/g, '').slice(0, 4))}
              keyboard="number-pad"
              secure
              maxLength={4}
            />
            <Field
              label="CONFIRM NEW PIN"
              value={confirmPin}
              onChange={(v) => setConfirmPin(v.replace(/[^\d]/g, '').slice(0, 4))}
              keyboard="number-pad"
              secure
              maxLength={4}
            />
            {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
            <Pressable
              style={[styles.button, pinBusy && styles.disabled]}
              onPress={() => void onChangePin()}
              disabled={pinBusy}
            >
              {pinBusy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>SUBMIT</Text>}
            </Pressable>
            <Pressable style={styles.pinCancel} onPress={closePinModal} disabled={pinBusy}>
              <Text style={styles.pinCancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {dialog}
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard,
  secure,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  secure?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 88, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#64748b"
        keyboardType={keyboard || 'default'}
        secureTextEntry={secure}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: '900', color: '#f8fafc', marginTop: 2 },
  sub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  identity: { flexDirection: 'row', gap: 14, marginBottom: 18, alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#f59e0b', fontWeight: '900', fontSize: 20 },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  teamLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#020617' },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainTag: { color: '#f59e0b', fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  editionCard: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  stat: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statNum: { color: '#f8fafc', fontWeight: '900', fontSize: 16 },
  statLbl: { color: '#64748b', fontSize: 9, fontWeight: '800', marginTop: 2, letterSpacing: 0.8 },
  lockedLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  lockedValue: { color: '#cbd5e1', fontWeight: '700', marginTop: 2 },
  section: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.4, marginTop: 10, marginBottom: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 1.4, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  chipOn: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)' },
  chipText: { color: '#94a3b8', fontWeight: '800', fontSize: 12 },
  chipTextOn: { color: '#f59e0b' },
  button: { backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#0f172a', fontWeight: '900', letterSpacing: 1.2 },
  secondary: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: { color: '#f8fafc', fontWeight: '800', letterSpacing: 1 },
  disabled: { opacity: 0.6 },
  error: { color: '#fca5a5', textAlign: 'center', marginBottom: 8, fontWeight: '700' },
  ok: { color: '#34d399', textAlign: 'center', marginBottom: 8, fontWeight: '700' },
  logout: {
    marginTop: 22,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 14,
  },
  logoutText: { color: '#fca5a5', fontWeight: '800', letterSpacing: 1.5 },
  deleteBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  deleteBtnText: { color: '#ef4444', fontWeight: '900', letterSpacing: 1.5, fontSize: 13 },
  deleteHint: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 12 },
  deleteConfirmBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteConfirmBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 1.2, fontSize: 13 },
  pinOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  pinBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,23,0.82)' },
  pinCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    padding: 18,
  },
  pinKicker: { fontSize: 11, fontWeight: '800', color: '#f59e0b', letterSpacing: 1.5 },
  pinTitle: { fontSize: 20, fontWeight: '900', color: '#f8fafc', marginTop: 4 },
  pinHint: { fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 14 },
  pinCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  pinCancelText: { color: '#94a3b8', fontWeight: '800', letterSpacing: 1.2 },
});
