// Push notification registration. Server-side delivery is a follow-up:
// you'll need to capture the token (logged here) and store it in Airtable
// against the driver, then send via FCM (Android) / APNs (iOS).
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export async function registerPush(onToken) {
  if (!Capacitor.isNativePlatform()) return;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('Push permission not granted');
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    console.log('Push token:', token.value);
    if (onToken) onToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration error:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Push action:', action);
  });
}
