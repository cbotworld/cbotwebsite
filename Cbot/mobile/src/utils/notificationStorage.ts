import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';
import { getSession } from '../api/website';

const NOTIFICATIONS_STORAGE_KEY = '@cbot_notifications_inbox_v1';
const READ_IDS_KEY = '@cbot_notifications_read_ids_v1';

export type PushNotificationItem = {
  id: string;
  title: string;
  body: string;
  type?: 'MATCH' | 'COMBI' | 'SCORES' | 'RESULTS' | 'ANNOUNCEMENT' | 'BROADCAST' | string;
  data?: Record<string, any>;
  receivedAt: string; // ISO string
  read: boolean;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Error in notification listener:', e);
    }
  });
}

export function addNotificationChangeListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get all stored notifications, merged with server announcements, sorted newest first.
 */
export async function getNotifications(): Promise<PushNotificationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const stored: PushNotificationItem[] = raw ? JSON.parse(raw) : [];

    const rawReadIds = await AsyncStorage.getItem(READ_IDS_KEY);
    const readIds: Set<string> = new Set(rawReadIds ? JSON.parse(rawReadIds) : []);

    // Try fetching latest server announcements/updates in background
    try {
      const session = getSession();
      const headers: Record<string, string> = {};
      if (config.appApiKey) headers['X-App-Key'] = config.appApiKey;
      if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

      const res = await fetch(`${config.apiBaseUrl}/mobile/notifications`, {
        method: 'GET',
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.notifications)) {
          const existingIds = new Set(stored.map((n) => n.id));
          let changed = false;

          for (const s of json.notifications) {
            if (!existingIds.has(s.id)) {
              stored.unshift({
                id: s.id,
                title: s.title,
                body: s.body,
                type: s.type || 'ANNOUNCEMENT',
                receivedAt: s.createdAt || new Date().toISOString(),
                read: readIds.has(s.id),
              });
              changed = true;
            }
          }

          if (changed) {
            await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(stored));
          }
        }
      }
    } catch {
      // Offline fallback: continue with locally stored notifications
    }

    // Apply read state
    const normalized = stored.map((item) => ({
      ...item,
      read: item.read || readIds.has(item.id),
    }));

    // Sort descending by date
    normalized.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    return normalized;
  } catch (error) {
    console.error('[NotificationStorage] Failed to get notifications:', error);
    return [];
  }
}

/**
 * Save a newly received push notification to local storage.
 */
export async function saveReceivedNotification(payload: {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const stored: PushNotificationItem[] = raw ? JSON.parse(raw) : [];

    const id = payload.id || `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Avoid exact duplicate IDs
    if (stored.some((item) => item.id === id)) {
      return;
    }

    const newItem: PushNotificationItem = {
      id,
      title: payload.title || 'CBOT Notification',
      body: payload.body || '',
      type: (payload.data?.type as string) || 'ANNOUNCEMENT',
      data: payload.data,
      receivedAt: new Date().toISOString(),
      read: false,
    };

    stored.unshift(newItem);
    // Keep at most 100 most recent notifications
    const trimmed = stored.slice(0, 100);
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(trimmed));
    notifyListeners();
  } catch (error) {
    console.error('[NotificationStorage] Failed to save notification:', error);
  }
}

/**
 * Get count of unread notifications.
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const list = await getNotifications();
    return list.filter((n) => !n.read).length;
  } catch {
    return 0;
  }
}

/**
 * Mark all notifications as read.
 */
export async function markAllAsRead(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return;
    const stored: PushNotificationItem[] = JSON.parse(raw);
    const readIds = new Set<string>();

    const updated = stored.map((item) => {
      readIds.add(item.id);
      return { ...item, read: true };
    });

    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(readIds)));
    notifyListeners();
  } catch (error) {
    console.error('[NotificationStorage] Failed to mark all as read:', error);
  }
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return;
    const stored: PushNotificationItem[] = JSON.parse(raw);

    const rawReadIds = await AsyncStorage.getItem(READ_IDS_KEY);
    const readIds: Set<string> = new Set(rawReadIds ? JSON.parse(rawReadIds) : []);
    readIds.add(id);

    const updated = stored.map((item) => (item.id === id ? { ...item, read: true } : item));
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(readIds)));
    notifyListeners();
  } catch (error) {
    console.error('[NotificationStorage] Failed to mark as read:', error);
  }
}

/**
 * Clear all stored notifications.
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    await AsyncStorage.removeItem(READ_IDS_KEY);
    notifyListeners();
  } catch (error) {
    console.error('[NotificationStorage] Failed to clear notifications:', error);
  }
}
