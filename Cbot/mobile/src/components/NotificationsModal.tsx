import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  clearAllNotifications,
  type PushNotificationItem,
} from '../utils/notificationStorage';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) {
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return `Yesterday, ${timeStr}`;
    }
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return 'Recent';
  }
}

function getTypeBadge(type?: string) {
  const t = (type || 'ANNOUNCEMENT').toUpperCase();
  if (t.includes('MATCH') || t.includes('GOLIVE')) {
    return { label: 'MATCH', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#ef4444' };
  }
  if (t.includes('COMBI')) {
    return { label: 'COMBI', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: '#0284c7' };
  }
  if (t.includes('SCORE')) {
    return { label: 'SCORES', bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399', border: '#059669' };
  }
  if (t.includes('RESULT') || t.includes('STAND')) {
    return { label: 'RESULTS', bg: 'rgba(167, 139, 250, 0.15)', text: '#a78bfa', border: '#7c3aed' };
  }
  if (t.includes('BROADCAST') || t.includes('PRACTICE')) {
    return { label: 'LIVE STREAM', bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: '#e11d48' };
  }
  return { label: 'ANNOUNCEMENT', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: '#d97706' };
}

export function NotificationsModal({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getNotifications();
      setNotifications(list);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void load();
    }
  }, [visible, load]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const handleItemPress = async (item: PushNotificationItem) => {
    if (!item.read) {
      await markAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        {/* Modal Top Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.bellIconWrap}>
              <Ionicons name="notifications" size={18} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>
                {notifications.length === 0
                  ? 'All caught up'
                  : unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                    : `${notifications.length} notification${notifications.length === 1 ? '' : 's'}`}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </Pressable>
        </View>

        {/* Quick Actions Bar */}
        {notifications.length > 0 ? (
          <View style={styles.actionsBar}>
            {unreadCount > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                onPress={handleMarkAllRead}
              >
                <Ionicons name="checkmark-done" size={14} color="#38bdf8" />
                <Text style={styles.actionBtnTextBlue}>Mark all as read</Text>
              </Pressable>
            ) : (
              <View />
            )}

            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              onPress={handleClearAll}
            >
              <Ionicons name="trash-outline" size={13} color="#94a3b8" />
              <Text style={styles.actionBtnTextMuted}>Clear all</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Content */}
        {loading && notifications.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading notifications…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={44} color="#475569" />
            </View>
            <Text style={styles.emptyTitle}>No Notifications Yet</Text>
            <Text style={styles.emptySubtitle}>
              You’ll see all your match schedule reminders, live stream updates, combi releases, and official announcements here.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
          >
            {notifications.map((item) => {
              const badge = getTypeBadge(item.type);
              const isUnread = !item.read;

              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.itemCard,
                    isUnread && styles.itemCardUnread,
                    pressed && styles.itemCardPressed,
                  ]}
                  onPress={() => void handleItemPress(item)}
                >
                  <View style={styles.itemTopRow}>
                    <View style={styles.badgeAndDot}>
                      {isUnread ? <View style={styles.unreadDot} /> : null}
                      <View
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Text style={[styles.typeBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.timeText}>{formatRelativeTime(item.receivedAt)}</Text>
                  </View>

                  <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemBody}>{item.body}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#0b1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionBtnTextBlue: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnTextMuted: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  itemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  itemCardUnread: {
    backgroundColor: '#131d33',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderLeftWidth: 3.5,
    borderLeftColor: '#f59e0b',
  },
  itemCardPressed: {
    opacity: 0.85,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeAndDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 5,
    lineHeight: 20,
  },
  itemTitleUnread: {
    color: '#ffffff',
    fontWeight: '900',
  },
  itemBody: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.7,
  },
});
