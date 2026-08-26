import { useMemo, useState } from 'react';
import {
  Alert,
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
import { SCORE_EDIT_PLAYER_HELP } from '../score-edit-policy';

export const MAX_DAY_BOARDS = 10;

export type BoardDraft = { score: string; slams: string };

export type SavedDayScore = {
  dayNumber: number;
  score?: number;
  slams?: number;
  boards?: Array<{ score?: number; slams?: number }>;
};

export function emptyBoardDraft(): BoardDraft {
  return { score: '', slams: '0' };
}

export function boardsFromSaved(row?: SavedDayScore | null): BoardDraft[] {
  const raw = row?.boards;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.slice(0, MAX_DAY_BOARDS).map((b) => ({
      score: b?.score == null ? '' : String(b.score),
      slams: String(b?.slams ?? 0),
    }));
  }
  if (row && row.score != null && Number.isFinite(Number(row.score))) {
    return [{ score: String(row.score), slams: String(row.slams ?? 0) }];
  }
  return [emptyBoardDraft()];
}

export function parseBoardDrafts(boards: BoardDraft[]) {
  const filled: Array<{ score: number; slams: number }> = [];
  for (const b of boards) {
    const score = parseInt(b.score, 10);
    const slams = parseInt(b.slams || '0', 10);
    if (!Number.isFinite(score) || score < 0) continue;
    filled.push({
      score,
      slams: Number.isFinite(slams) && slams >= 0 ? slams : 0,
    });
  }
  const total = filled.reduce((s, b) => s + b.score, 0);
  const slams = filled.reduce((s, b) => s + b.slams, 0);
  const boardCount = filled.length;
  const average = boardCount > 0 ? Math.round((total / boardCount) * 100) / 100 : null;
  return { filled, total, slams, boardCount, average };
}

export function targetBonus(total: number | null, target?: number | null) {
  if (total == null || !Number.isFinite(total)) return null;
  const tgt = Number(target);
  if (!Number.isFinite(tgt) || tgt <= 0) return null;
  return total < tgt;
}

export function dayWindowOpen(scoreInfo: any, dayNumber: number) {
  const meta = (scoreInfo?.days || []).find((d: any) => d.dayNumber === dayNumber);
  if (meta) return Boolean(meta.windowOpen);
  return Boolean(scoreInfo?.windowOpen) && Number(scoreInfo?.eligibleDay) === dayNumber;
}

export function dayWindowReason(scoreInfo: any, dayNumber: number) {
  const meta = (scoreInfo?.days || []).find((d: any) => d.dayNumber === dayNumber);
  return meta?.windowReason || scoreInfo?.windowReason || SCORE_EDIT_PLAYER_HELP;
}

export function BoardScoreModal({
  visible,
  dayNumber,
  playerName,
  target,
  initialBoards,
  busy,
  editNote,
  onClose,
  onSave,
}: {
  visible: boolean;
  dayNumber: number;
  playerName?: string;
  target?: number | null;
  initialBoards: BoardDraft[];
  busy?: boolean;
  editNote?: string;
  onClose: () => void;
  onSave: (boards: Array<{ score: number; slams: number }>) => void;
}) {
  const [boards, setBoards] = useState<BoardDraft[]>(
    initialBoards.length ? initialBoards : [emptyBoardDraft()],
  );

  const stats = useMemo(() => parseBoardDrafts(boards), [boards]);
  const bonus = targetBonus(stats.boardCount ? stats.total : null, target);
  const tgt = Number(target) || 0;

  const update = (idx: number, patch: Partial<BoardDraft>) => {
    setBoards((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{playerName ? `${playerName} · Day ${dayNumber}` : `Day ${dayNumber} boards`}</Text>
          <Text style={styles.hint}>
            {editNote || SCORE_EDIT_PLAYER_HELP} Enter each board. Total vs target decides target bonus. Max {MAX_DAY_BOARDS} boards.
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            {boards.map((board, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.boardLabel}>B{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>SCORE</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={board.score}
                    onChangeText={(t) => update(idx, { score: t.replace(/[^\d]/g, '') })}
                    placeholder="score"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ width: 72 }}>
                  <Text style={styles.fieldLabel}>SLAM</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={board.slams}
                    onChangeText={(t) => update(idx, { slams: t.replace(/[^\d]/g, '').slice(0, 1) })}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                  />
                </View>
                {boards.length > 1 ? (
                  <Pressable onPress={() => setBoards((prev) => prev.filter((_, i) => i !== idx))}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                ) : (
                  <View style={{ width: 18 }} />
                )}
              </View>
            ))}
            {boards.length < MAX_DAY_BOARDS ? (
              <Pressable
                style={styles.addBtn}
                onPress={() => setBoards((prev) => [...prev, emptyBoardDraft()])}
              >
                <Text style={styles.addText}>
                  ADD BOARD ({boards.length}/{MAX_DAY_BOARDS})
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <View style={styles.stats}>
            <Text style={styles.stat}>Total {stats.boardCount ? stats.total : '—'}</Text>
            <Text style={styles.stat}>Slams {stats.boardCount ? stats.slams : '—'}</Text>
            <Text style={styles.stat}>Boards {stats.boardCount || '—'}</Text>
            <Text style={styles.stat}>Avg {stats.average == null ? '—' : stats.average}</Text>
            <Text style={styles.stat}>Target {tgt > 0 ? tgt : '0 (no bonus)'}</Text>
            <Text style={[styles.stat, bonus === true && styles.bonusYes]}>
              Target bonus {stats.boardCount === 0 ? '—' : bonus === true ? 'Yes' : tgt > 0 ? 'No' : '—'}
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.save, busy && { opacity: 0.55 }]}
              disabled={busy}
              onPress={() => {
                if (!stats.filled.length) {
                  Alert.alert('Boards', 'Enter at least one board score.');
                  return;
                }
                onSave(stats.filled);
              }}
            >
              <Text style={styles.saveText}>{busy ? 'SAVING…' : `SAVE DAY ${dayNumber}`}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    padding: 16,
    paddingBottom: 28,
    gap: 10,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  hint: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  boardLabel: { color: '#f59e0b', fontWeight: '900', width: 28, paddingBottom: 10, fontSize: 12 },
  fieldLabel: { color: '#64748b', fontSize: 9, fontWeight: '800', marginBottom: 4 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#fff',
    fontWeight: '800',
    paddingHorizontal: 10,
    height: 42,
  },
  remove: { color: '#fb7185', fontWeight: '900', paddingBottom: 12, fontSize: 16 },
  addBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  addText: { color: '#f59e0b', fontWeight: '900', fontSize: 11 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  bonusYes: { color: '#34d399', fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: '#cbd5e1', fontWeight: '800', fontSize: 12 },
  save: {
    flex: 1.4,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { color: '#0f172a', fontWeight: '900', fontSize: 12 },
});
