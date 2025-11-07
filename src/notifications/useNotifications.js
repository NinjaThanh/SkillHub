// // src/notifications/useNotifications.ts
// import { useEffect } from 'react';
// import { Platform } from 'react-native';
// import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
// import notifee, { AndroidImportance } from '@notifee/react-native';
//
// type NotificationDoc = {
//     title?: string;
//     body?: string;
//     type?: 'job_posted' | 'job_applied';
//     read?: boolean;
//     createdAt?: FirebaseFirestoreTypes.Timestamp | null;
//     jobId?: string;
//     jobTitle?: string;
//     applicantId?: string;
//     applicantName?: string;
// };
//
// export default function useNotifications(uid: string | null) {
//     useEffect(() => {
//         if (!uid) return;
//
//         const q = firestore()
//             .collection('users')
//             .doc(uid)
//             .collection('notifications')
//             .where('read', '==', false)
//             .orderBy('createdAt', 'desc')
//             .limit(10);
//
//         const unsubscribe = q.onSnapshot(async (snapshot) => {
//             for (const change of snapshot.docChanges()) {
//                 if (change.type !== 'added') continue;
//
//                 const data = change.doc.data() as NotificationDoc;
//
//                 // iOS: xin quyền; Android: tạo channel
//                 if (Platform.OS === 'ios') {
//                     await notifee.requestPermission();
//                 } else {
//                     await notifee.createChannel({
//                         id: 'default',
//                         name: 'Default Channel',
//                         importance: AndroidImportance.HIGH,
//                     });
//                 }
//
//                 await notifee.displayNotification({
//                     title: data.title || 'Thông báo mới',
//                     body: data.body || '',
//                     ...(Platform.OS === 'android' ? { android: { channelId: 'default' } } : {}),
//                 });
//
//                 // Đánh dấu đã đọc (an toàn với try/catch để không crash nếu rules chặn)
//                 try {
//                     await change.doc.ref.update({ read: true });
//                 } catch (e) {
//                     // eslint-disable-next-line no-console
//                     console.warn('[useNotifications] mark read failed:', (e as any)?.message || e);
//                 }
//             }
//         });
//
//         return () => unsubscribe();
//     }, [uid]);
// }
