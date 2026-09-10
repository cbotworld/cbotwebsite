import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playerScoreUntilNote } from '../score-edit-policy';
import { useAppDialog } from './AppDialog';

export const MAX_DAY_BOARDS = 10;
export const DEFAULT_DAY_BOARDS = 3;

export type BoardDraft = { score: string; slams: string };

export type SavedDayScore = {
  dayNumber?: number;
  score?: number;
  slams?: number;
  boards?: Array<{ score?: number; slams?: number }>;
};

export function emptyBoardDraft(): BoardDraft {
  return { score: '', slams: '0' };
}

export function emptyBoards(count = DEFAULT_DAY_BOARDS): BoardDraft[] {
  return Array.from({ length: Math.max(1, count) }, () => emptyBoardDraft());
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
  return emptyBoards();
}

export function parseBoardDrafts(boards: BoardDraft[]) {
  const filled: Array<{ score: number; slams: number }> = [];
  for (const b of boards) {
    const score = parseInt(b.score, 10);
    const slams = parseInt(b.slams || '0', 10);
    const validSlam = Number.isFinite(slams) && slams > 0 ? 1 : 0;
    if (!Number.isFinite(score)) continue;
    if (validSlam === 0 && score < 0) continue;
    filled.push({
      score,
      slams: validSlam,
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

export function BoardScoreModal({
  visible,
  dayNumber,
  playerName,
  target,
  initialBoards,
  busy,
  editNote,
  closeLabel,
  submitLabel,
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
  closeLabel?: string;
  submitLabel?: string;
  onClose: () => void;
  onSave: (boards: Array<{ score: number; slams: number }>) => void;
}) {
  const [boards, setBoards] = useState<BoardDraft[]>(
    initialBoards.length ? initialBoards : emptyBoards(),
  );

  useEffect(() => {
    if (!visible) return;
    setBoards(initialBoards.length ? initialBoards : emptyBoards());
  }, [visible, initialBoards]);

  const stats = useMemo(() => parseBoardDrafts(boards), [boards]);
  const bonus = targetBonus(stats.boardCount ? stats.total : null, target);
  const tgt = Number(target) || 0;
  const { dialog, showWarn, showConfirm } = useAppDialog();

  const update = (idx: number, patch: Partial<BoardDraft>) => {
    setBoards((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeBoard = (idx: number) => {
    if (boards.length <= 1) return;
    setBoards((prev) => prev.filter((_, i) => i !== idx));
  };

  const addBoard = () => {
    if (boards.length >= MAX_DAY_BOARDS) return;
    setBoards((prev) => [...prev, emptyBoardDraft()]);
  };

  const handleConfirmAndSubmit = () => {
    if (!stats.filled.length) {
      showWarn('Incomplete Scores', 'Please enter at least one board score before submitting.');
      return;
    }

    const bonusLabel = tgt > 0 ? (bonus === true ? 'Yes (+1 Bonus)' : 'No') : 'N/A';
    const targetText = tgt > 0 ? `${tgt} pts` : 'No Target';

    showConfirm(
      'Confirm Score Submission',
      `Day ${dayNumber} — please confirm:\n\n` +
        `Total Score: ${stats.total} pts\n` +
        `Total Slams: ${stats.slams}\n` +
        `Target Bonus: ${bonusLabel}\n` +
        `Target: ${targetText}\n` +
        `Boards: ${stats.boardCount}`,
      () => onSave(stats.filled),
      { confirmLabel: 'Confirm & Submit', cancelLabel: 'Cancel' },
    );
  };

  const ctaTitle =
    submitLabel ||
    (playerName ? `CONFIRM & SUBMIT FOR ${playerName.toUpperCase()}` : 'CONFIRM & SUBMIT BY PLAYER');

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top Full Screen Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.backBtn}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backBtnText}>‹ Back</Text>
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTag}>DAY {dayNumber} SCORE SUBMISSION</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {playerName ? `${playerName}` : `Day ${dayNumber} Scores`}
              </Text>
            </View>

            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Hint / Instructions Bar */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>
                {editNote || playerScoreUntilNote(dayNumber)} Enter each board’s score and slams below. Total score strictly below target achieves the Target Bonus.
              </Text>
            </View>

            {/* Board Cards Breakdown */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>BOARDS BREAKDOWN</Text>
              <Text style={styles.sectionSubtitle}>
                {boards.length} of {MAX_DAY_BOARDS} max
              </Text>
            </View>

            <View style={styles.boardsContainer}>
              {boards.map((board, idx) => {
                const isSlam = board.slams === '1';
                const boardScoreNum = parseInt(board.score, 10);
                const isFilled = Number.isFinite(boardScoreNum) && (isSlam || boardScoreNum >= 0);

                return (
                  <View
                    key={idx}
                    style={[
                      styles.boardCard,
                      isFilled && styles.boardCardFilled,
                    ]}
                  >
                    <View style={styles.boardCardHeader}>
                      <View style={styles.boardPill}>
                        <Text style={styles.boardPillText}>BOARD {idx + 1}</Text>
                      </View>

                      {boards.length > 1 ? (
                        <Pressable
                          style={styles.removeBtn}
                          onPress={() => removeBoard(idx)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove Board ${idx + 1}`}
                        >
                          <Text style={styles.removeBtnText}>✕ Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.boardInputsRow}>
                      {/* Score Input */}
                      <View style={styles.scoreCol}>
                        <Text style={styles.inputLabel}>SCORE / POINTS</Text>
                        <View style={styles.scoreControlRow}>
                          <Pressable
                            style={styles.scoreStepperBtn}
                            onPress={() => {
                              const currentVal = parseInt(board.score, 10) || 0;
                              const nextVal = isSlam ? currentVal - 1 : Math.max(0, currentVal - 1);
                              update(idx, { score: String(nextVal) });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Decrease score"
                          >
                            <Text style={styles.scoreStepperText}>−</Text>
                          </Pressable>

                          <View style={styles.inputWrap}>
                            <TextInput
                              style={[
                                styles.scoreInput,
                                isSlam && boardScoreNum < 0 && { color: '#f87171' },
                              ]}
                              keyboardType={isSlam ? "numbers-and-punctuation" : "number-pad"}
                              value={board.score}
                              onChangeText={(t) => {
                                if (board.slams === '1') {
                                  let sanitized = t.replace(/[^\d-]/g, '');
                                  if (sanitized.includes('-')) {
                                    const isNeg = sanitized.startsWith('-');
                                    sanitized = (isNeg ? '-' : '') + sanitized.replace(/-/g, '');
                                  }
                                  update(idx, { score: sanitized });
                                } else {
                                  update(idx, { score: t.replace(/[^\d]/g, '') });
                                }
                              }}
                              placeholder="0"
                              placeholderTextColor="#475569"
                              maxLength={5}
                              selectTextOnFocus
                            />
                          </View>

                          <Pressable
                            style={styles.scoreStepperBtn}
                            onPress={() => {
                              const currentVal = parseInt(board.score, 10) || 0;
                              const nextVal = currentVal + 1;
                              update(idx, { score: String(nextVal) });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Increase score"
                          >
                            <Text style={styles.scoreStepperText}>+</Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* Slams Input & Quick Selection */}
                      <View style={styles.slamsCol}>
                        <Text style={styles.inputLabel}>SLAM</Text>
                        <View style={styles.slamChipsRow}>
                          <Pressable
                            style={[
                              styles.slamChip,
                              board.slams === '1' && styles.slamChipActive,
                            ]}
                            onPress={() => update(idx, { slams: '1' })}
                          >
                            <Text
                              style={[
                                styles.slamChipText,
                                board.slams === '1' && styles.slamChipTextActive,
                              ]}
                            >
                              YES
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.slamChip,
                              board.slams !== '1' && styles.slamChipActive,
                            ]}
                            onPress={() => {
                              const curScore = parseInt(board.score, 10) || 0;
                              update(idx, {
                                slams: '0',
                                ...(curScore < 0 ? { score: '0' } : {}),
                              });
                            }}
                          >
                            <Text
                              style={[
                                styles.slamChipText,
                                board.slams !== '1' && styles.slamChipTextActive,
                              ]}
                            >
                              NO
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Add Board CTA */}
              {boards.length < MAX_DAY_BOARDS ? (
                <Pressable
                  style={styles.addBoardBtn}
                  onPress={addBoard}
                  accessibilityRole="button"
                  accessibilityLabel="Add Board"
                >
                  <Text style={styles.addBoardIcon}>+</Text>
                  <Text style={styles.addBoardText}>
                    ADD BOARD {boards.length + 1} OF {MAX_DAY_BOARDS}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.maxBoardsBanner}>
                  <Text style={styles.maxBoardsText}>Maximum of {MAX_DAY_BOARDS} boards reached.</Text>
                </View>
              )}
            </View>

            {/* MATCH SUMMARY DASHBOARD CARD (Moved to bottom) */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.summaryCardHeading}>MATCH SUMMARY</Text>
                {tgt > 0 && stats.boardCount > 0 ? (
                  <View style={[styles.targetStatusPill, bonus === true ? styles.targetStatusPillYes : styles.targetStatusPillNo]}>
                    <Text style={[styles.targetStatusText, bonus === true && styles.targetStatusTextYes]}>
                      {bonus === true ? '✓ BONUS QUALIFIED' : 'NO BONUS'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* PRIMARY STATS ROW: Total Score | Total Slams | Target Bonus (Yes/No) */}
              <View style={styles.primaryStatsRow}>
                {/* Total Score */}
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>TOTAL SCORE</Text>
                  <Text style={styles.statScoreValue}>
                    {stats.boardCount ? stats.total : '—'}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                {/* Total Slams */}
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>TOTAL SLAMS</Text>
                  <Text style={styles.statSlamsValue}>
                    {stats.boardCount ? stats.slams : '—'}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                {/* Target Bonus (Yes/No) */}
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>TARGET BONUS</Text>
                  <View
                    style={[
                      styles.bonusPill,
                      stats.boardCount > 0 && bonus === true && styles.bonusPillYes,
                      stats.boardCount > 0 && bonus === false && styles.bonusPillNo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bonusPillText,
                        stats.boardCount > 0 && bonus === true && styles.bonusPillTextYes,
                        stats.boardCount > 0 && bonus === false && styles.bonusPillTextNo,
                      ]}
                    >
                      {stats.boardCount === 0
                        ? '—'
                        : tgt <= 0
                        ? 'N/A'
                        : bonus === true
                        ? 'YES'
                        : 'NO'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* SECONDARY ROW: Below Target | No. of Boards */}
              <View style={styles.secondaryStatsRow}>
                <View style={styles.subStatBox}>
                  <Text style={styles.subStatLabel}>TARGET</Text>
                  <Text style={styles.subStatValue}>
                    {tgt > 0 ? `${tgt} PTS` : '0 (NO TARGET)'}
                  </Text>
                </View>

                <View style={styles.subStatDivider} />

                <View style={styles.subStatBox}>
                  <Text style={styles.subStatLabel}>NO. OF BOARDS</Text>
                  <Text style={styles.subStatValue}>
                    {stats.boardCount ? `${stats.boardCount} BOARD${stats.boardCount === 1 ? '' : 'S'}` : `${boards.length} BOARDS`}
                  </Text>
                </View>

                <View style={styles.subStatDivider} />

                <View style={styles.subStatBox}>
                  <Text style={styles.subStatLabel}>AVG / BOARD</Text>
                  <Text style={styles.subStatValue}>
                    {stats.average == null ? '—' : stats.average}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Action Bar with Confirm and Submit */}
          <View style={styles.footer}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>{closeLabel || 'CANCEL'}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveBtn,
                (!stats.filled.length || busy) && styles.saveBtnDisabled,
              ]}
              disabled={busy}
              onPress={handleConfirmAndSubmit}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#020617" size="small" />
              ) : (
                <Text style={styles.saveBtnText} numberOfLines={1}>
                  {ctaTitle}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </Modal>
      {dialog}
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  keyboardRoot: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#020617',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 13,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerTag: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  headerRightPlaceholder: {
    width: 60,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    padding: 16,
    gap: 14,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCardHeading: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  targetStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  targetStatusPillYes: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
  },
  targetStatusPillNo: {
    backgroundColor: 'rgba(244,63,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  targetStatusText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  targetStatusTextYes: {
    color: '#34d399',
  },
  primaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#334155',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statScoreValue: {
    color: '#f59e0b',
    fontSize: 22,
    fontWeight: '900',
  },
  statSlamsValue: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
  },
  bonusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    marginTop: 2,
  },
  bonusPillYes: {
    backgroundColor: '#10b981',
  },
  bonusPillNo: {
    backgroundColor: '#e11d48',
  },
  bonusPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '900',
  },
  bonusPillTextYes: {
    color: '#020617',
    fontWeight: '900',
  },
  bonusPillTextNo: {
    color: '#ffffff',
    fontWeight: '900',
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  subStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  subStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#1e293b',
  },
  subStatLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  subStatValue: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '900',
  },
  infoBanner: {
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionSubtitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  boardsContainer: {
    gap: 12,
  },
  boardCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    gap: 12,
  },
  boardCardFilled: {
    borderColor: 'rgba(245,158,11,0.35)',
  },
  boardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boardPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  boardPillText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  removeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '800',
  },
  boardInputsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  scoreCol: {
    flex: 1.3,
    gap: 6,
  },
  slamsCol: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputWrap: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  scoreInput: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  scoreControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreStepperBtn: {
    width: 32,
    height: 48,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreStepperText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  slamChipsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 48,
    alignItems: 'center',
  },
  slamChip: {
    flex: 1,
    height: 48,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slamChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  slamChipText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '900',
  },
  slamChipTextActive: {
    color: '#020617',
  },
  slamCustomInput: {
    width: 44,
    height: 48,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  addBoardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,158,11,0.5)',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  addBoardIcon: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '900',
  },
  addBoardText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  maxBoardsBanner: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  maxBoardsText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#020617',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 2.2,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#020617',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
