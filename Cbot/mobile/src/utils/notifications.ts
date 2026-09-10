import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { config } from '../config';
import { getSession } from '../api/website';
import { saveReceivedNotification } from './notificationStorage';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let listenersInitialized = false;

export function initNotificationListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  // Foreground notification received listener
  Notifications.addNotificationReceivedListener((notification) => {
    const title = notification.request.content.title || 'CBOT Notification';
    const body = notification.request.content.body || '';
    const data = notification.request.content.data as Record<string, any> | undefined;
    const id = notification.request.identifier;
    void saveReceivedNotification({ id, title, body, data });
  });

  // User tapped / responded to notification
  Notifications.addNotificationResponseReceivedListener((response) => {
    const title = response.notification.request.content.title || 'CBOT Notification';
    const body = response.notification.request.content.body || '';
    const data = response.notification.request.content.data as Record<string, any> | undefined;
    const id = response.notification.request.identifier;
    void saveReceivedNotification({ id, title, body, data });
  });
}

/**
 * Register for Push Notifications with Expo Push Service and send token to CBOT backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const session = getSession();
    if (!session?.token) {
      console.log('[Notifications] Skipping push registration — user not logged in.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('cbot-default', {
        name: 'CBOT Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f59e0b',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Push notification permission denied.');
      return null;
    }

    // Fetch Expo Push Token using exact EAS projectId
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f4ca4f57-6593-4d04-9e02-ae5939b964ca';
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    }).catch(async () => {
      return await Notifications.getExpoPushTokenAsync();
    });

    const token = tokenData?.data;
    if (!token) {
      console.warn('[Notifications] Could not get Expo Push Token.');
      return null;
    }

    console.log('[Notifications] Registered Expo Push Token:', token);

    // Send push token to backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.appApiKey) headers['X-App-Key'] = config.appApiKey;
    if (session.token) headers['Authorization'] = `Bearer ${session.token}`;

    await fetch(`${config.apiBaseUrl}/mobile/push-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    }).catch((err) => console.warn('[Notifications] Failed to send push token to backend:', err));

    return token;
  } catch (error) {
    console.error('[Notifications] Error registering push notifications:', error);
    return null;
  }
}
