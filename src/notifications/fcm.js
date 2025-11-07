// import messaging from '@react-native-firebase/messaging';
// import { Platform } from 'react-native';
//
// /** Khởi tạo FCM, xin quyền (Android 13+ / iOS), lắng nghe foreground messages. */
// export async function initFCM() {
//     // iOS/Android 13+: xin quyền thông báo (Android < 13 tự granted)
//     await messaging().requestPermission();
//
//     // Lấy FCM token (tùy bạn gửi token lên server nếu cần)
//     try {
//         const token = await messaging().getToken();
//         if (__DEV__) console.log('[FCM] token:', token);
//     } catch (e) {
//         if (__DEV__) console.warn('[FCM] getToken error:', (e as any)?.message || e);
//     }
//
//     // App mở ở foreground: nhận message
//     const unsubscribeOnMessage = messaging().onMessage(async (_remoteMessage) => {
//         // Bạn có thể log / xử lý message nếu muốn
//         if (__DEV__) console.log('[FCM] foreground message:', _remoteMessage?.data || _remoteMessage?.notification);
//     });
//
//     // Android: tạo channel ở Notifee là chuyện của hook useNotifications; ở đây chỉ FCM.
//     return () => {
//         unsubscribeOnMessage();
//     };
// }
