import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from 'expo-image-picker';
import { getSession } from '../api/website';
import { config } from '../config';

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
}

type AttachedImage = {
  uri: string;
  mime: string;
};

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────
function emailValid(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

// ──────────────────────────────────────────────
//  Component
// ──────────────────────────────────────────────
export function ReportIssueModal({ visible, onClose }: Props) {
  const session = getSession();
  const isLoggedIn = Boolean(session?.token);

  // Pre-fill from session for logged-in users
  const [name, setName] = useState(session?.user?.name ?? '');
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');

  // Re-sync session fields whenever modal opens
  const handleOpen = useCallback(() => {
    const s = getSession();
    setName(s?.user?.name ?? '');
    setEmail(s?.user?.email ?? '');
    setComment('');
    setImages([]);
    setBusy(false);
    setSubmitted(false);
    setTicketNumber('');
  }, []);

  const pickImage = useCallback(async () => {
    if (images.length >= 5) {
      Alert.alert('Limit reached', 'You can attach up to 5 photos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newImgs = result.assets.map((asset) => ({
        uri: asset.uri,
        mime: asset.mimeType ?? 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...newImgs].slice(0, 5));
    }
  }, [images.length]);

  const takePhoto = useCallback(async () => {
    if (images.length >= 5) {
      Alert.alert('Limit reached', 'You can attach up to 5 photos.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a screenshot or photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setImages((prev) => [...prev, { uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg' }].slice(0, 5));
    }
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!emailValid(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!comment.trim()) {
      Alert.alert('Description required', 'Please describe the issue.');
      return;
    }

    setBusy(true);
    try {
      const token = getSession()?.token;
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim());
      formData.append('comment', comment.trim());

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const filename = img.uri.split('/').pop() ?? `screenshot_${i + 1}.jpg`;
        formData.append('image', {
          uri: img.uri,
          name: filename,
          type: img.mime,
        } as unknown as Blob);
      }

      const headers: Record<string, string> = {};
      if (config.appApiKey) headers['X-App-Key'] = config.appApiKey;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${config.apiBaseUrl}/mobile/report-issue`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Unknown error' }));
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Server error (${res.status})`);
      }
      setTicketNumber(data.ticketNumber ?? '');
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Submission failed', msg);
    } finally {
      setBusy(false);
    }
  }, [name, email, comment, images]);

  const handleClose = useCallback(() => {
    setComment('');
    setImages([]);
    setSubmitted(false);
    setTicketNumber('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      onShow={handleOpen}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Report an Issue</Text>
            <Text style={styles.headerSub}>We'll respond via email within 24–48 hrs</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {submitted ? (
          /* ── Success screen ─────────────────────── */
          <View style={styles.successWrap}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Report Submitted!</Text>
            <Text style={styles.successSub}>
              Your issue has been sent to the CBOT team. A confirmation has been sent to{' '}
              <Text style={styles.successEmail}>{email}</Text>.
            </Text>
            {ticketNumber ? (
              <View style={styles.ticketBox}>
                <Text style={styles.ticketLabel}>Your Ticket Number</Text>
                <Text style={styles.ticketNum}>{ticketNumber}</Text>
              </View>
            ) : null}
            <Pressable style={styles.doneBtn} onPress={handleClose}>
              <Text style={styles.doneBtnText}>DONE</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Form ───────────────────────────────── */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Text style={styles.label}>Your Name *</Text>
              <TextInput
                style={[styles.input, isLoggedIn && styles.inputReadonly]}
                value={name}
                onChangeText={setName}
                editable={!isLoggedIn}
                placeholder="Enter your name"
                placeholderTextColor="#475569"
                autoCapitalize="words"
              />

              {/* Email */}
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={[styles.input, isLoggedIn && styles.inputReadonly]}
                value={email}
                onChangeText={setEmail}
                editable={!isLoggedIn}
                placeholder="Enter your email"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {isLoggedIn && (
                <Text style={styles.autofillNote}>
                  ✓ Auto-filled from your account
                </Text>
              )}

              {/* Screenshots / Photos */}
              <Text style={styles.label}>Screenshots / Photos ({images.length}/5)</Text>

              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                  {images.map((img, idx) => (
                    <View key={`${img.uri}-${idx}`} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                      <Pressable
                        onPress={() => removeImage(idx)}
                        style={styles.thumbRemoveBtn}
                        hitSlop={8}
                      >
                        <Text style={styles.thumbRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {images.length < 5 && (
                <View style={styles.imageRow}>
                  <Pressable style={styles.imageBtn} onPress={pickImage}>
                    <Text style={styles.imageBtnIcon}>🖼</Text>
                    <Text style={styles.imageBtnText}>Choose Photo</Text>
                  </Pressable>
                  <Pressable style={styles.imageBtn} onPress={takePhoto}>
                    <Text style={styles.imageBtnIcon}>📷</Text>
                    <Text style={styles.imageBtnText}>Take Photo</Text>
                  </Pressable>
                </View>
              )}

              {/* Comment */}
              <Text style={styles.label}>Describe the Issue *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={comment}
                onChangeText={setComment}
                placeholder="Please describe what went wrong, steps to reproduce, or any other details…"
                placeholderTextColor="#475569"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={3000}
              />
              <Text style={styles.charCount}>{comment.length} / 3000</Text>

              {/* Submit */}
              <Pressable
                style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>SEND REPORT</Text>
                )}
              </Pressable>

              <Text style={styles.footer}>
                📧 Reports are sent to cbotworld@gmail.com.{'\n'}
                You'll receive a confirmation at your email with a ticket number.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ──────────────────────────────────────────────
//  Styles
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },

  // Form
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    color: '#f8fafc',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputReadonly: {
    borderColor: '#0f172a',
    color: '#64748b',
  },
  textarea: {
    height: 120,
    paddingTop: 12,
  },
  autofillNote: {
    color: '#22c55e',
    fontSize: 11,
    marginTop: 5,
    fontWeight: '600',
  },
  charCount: {
    color: '#334155',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },

  // Image
  imageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  imageBtnIcon: {
    fontSize: 22,
  },
  imageBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  // Image Thumbnails
  thumbScroll: {
    marginBottom: 10,
  },
  thumbWrap: {
    position: 'relative',
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumbImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Submit
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  footer: {
    color: '#334155',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },

  // Success
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  successTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  successSub: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successEmail: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  ticketBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  ticketLabel: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  ticketNum: {
    color: '#d97706',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  doneBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
