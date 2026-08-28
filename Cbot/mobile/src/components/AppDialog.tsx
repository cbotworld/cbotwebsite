/**
 * AppDialog — in-app replacement for React Native's native Alert.
 * Matches the CBOT mobile dark UI (navy/slate bg, amber accents).
 *
 * Usage:
 *   const { dialog, showDialog, showConfirm, showSuccess, showError } = useAppDialog();
 *   ...
 *   showSuccess('Saved!', 'Day 2 scores submitted.');
 *   showConfirm('Sign out?', 'You will need username + PIN to sign in.', onConfirm);
 *   ...
 *   return <>{dialog}</>
 */
import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type DialogButton = {
  label: string;
  onPress?: () => void;
  style?: 'primary' | 'danger' | 'cancel';
};

export type DialogConfig = {
  icon?: string;
  title: string;
  message?: string;
  buttons?: DialogButton[];
  /** 'success' | 'error' | 'warn' | 'info' — drives icon + accent colour */
  variant?: 'success' | 'error' | 'warn' | 'info' | 'confirm';
};

type DialogState = DialogConfig & { visible: boolean };

const ACCENT: Record<string, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warn: '#f59e0b',
  info: '#38bdf8',
  confirm: '#f59e0b',
};

const DEFAULT_ICON: Record<string, string> = {
  success: '✅',
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  confirm: '❓',
};

function DialogView({ state, onClose }: { state: DialogState; onClose: (btn?: DialogButton) => void }) {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const variant = state.variant || 'info';
  const accent = ACCENT[variant];
  const icon = state.icon ?? DEFAULT_ICON[variant];

  const buttons: DialogButton[] = state.buttons ?? [{ label: 'OK', style: 'primary' }];

  // Animate in
  useState(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  });

  return (
    <Modal transparent visible={state.visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose()} />
        <Animated.View style={[styles.card, { transform: [{ scale }], borderColor: `${accent}40` }]}>
          {/* Accent top bar */}
          <View style={[styles.topBar, { backgroundColor: accent }]} />

          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.title, { color: accent }]}>{state.title}</Text>
          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}

          <View style={[styles.btnRow, buttons.length === 1 && styles.btnRowSingle]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDanger = btn.style === 'danger';
              const isPrimary = btn.style === 'primary' || (!isCancel && !isDanger);
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.btn,
                    isCancel && styles.btnCancel,
                    isDanger && styles.btnDanger,
                    isPrimary && [styles.btnPrimary, { backgroundColor: accent }],
                  ]}
                  onPress={() => onClose(btn)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isCancel && styles.btnTextCancel,
                      isDanger && styles.btnTextDanger,
                      isPrimary && styles.btnTextPrimary,
                    ]}
                  >
                    {btn.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Hook — use inside any screen component */
export function useAppDialog() {
  const [state, setState] = useState<DialogState>({
    visible: false,
    title: '',
    variant: 'info',
  });

  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const showDialog = useCallback((config: DialogConfig) => {
    setState({ ...config, visible: true });
  }, []);

  const handleClose = useCallback(
    (btn?: DialogButton) => {
      hide();
      // Run the button's onPress AFTER modal closes (next tick)
      if (btn?.onPress) {
        setTimeout(btn.onPress, 120);
      }
    },
    [hide],
  );

  const showSuccess = useCallback(
    (title: string, message?: string, onOk?: () => void) =>
      showDialog({
        variant: 'success',
        title,
        message,
        buttons: [{ label: 'OK', style: 'primary', onPress: onOk }],
      }),
    [showDialog],
  );

  const showError = useCallback(
    (title: string, message?: string, onOk?: () => void) =>
      showDialog({
        variant: 'error',
        title,
        message,
        buttons: [{ label: 'OK', style: 'primary', onPress: onOk }],
      }),
    [showDialog],
  );

  const showWarn = useCallback(
    (title: string, message?: string, onOk?: () => void) =>
      showDialog({
        variant: 'warn',
        title,
        message,
        buttons: [{ label: 'OK', style: 'primary', onPress: onOk }],
      }),
    [showDialog],
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string | undefined,
      onConfirm: () => void,
      opts?: { confirmLabel?: string; confirmStyle?: 'danger' | 'primary'; cancelLabel?: string },
    ) =>
      showDialog({
        variant: 'confirm',
        title,
        message,
        buttons: [
          { label: opts?.cancelLabel ?? 'Cancel', style: 'cancel' },
          {
            label: opts?.confirmLabel ?? 'Confirm',
            style: opts?.confirmStyle ?? 'primary',
            onPress: onConfirm,
          },
        ],
      }),
    [showDialog],
  );

  const dialog = state.visible ? (
    <DialogView state={state} onClose={handleClose} />
  ) : null;

  return { dialog, showDialog, showSuccess, showError, showWarn, showConfirm, hide };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    borderWidth: 1,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
  },
  topBar: { width: '100%', height: 4 },
  icon: { fontSize: 42, marginTop: 22, marginBottom: 4 },
  title: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  message: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    width: '100%',
  },
  btnRowSingle: { flexDirection: 'column' },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnPrimary: {},
  btnCancel: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnDanger: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  btnText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  btnTextPrimary: { color: '#0f172a' },
  btnTextCancel: { color: '#94a3b8' },
  btnTextDanger: { color: '#ef4444' },
});
