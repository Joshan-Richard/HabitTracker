import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBibZwL3HsZXlfGZ_WhhQFs__62WuhyFjE",
  authDomain: "habitt-e0579.firebaseapp.com",
  projectId: "habitt-e0579",
  storageBucket: "habitt-e0579.firebasestorage.app",
  messagingSenderId: "291421771100",
  appId: "1:291421771100:web:96a85ee4b33eba3cd85d99",
  measurementId: "G-WQ8R86Z9Q2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent cache (multi-tab support)
const db = initializeFirestore(app, {
  cache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Initialize Storage
const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn('Firebase Messaging not supported in this browser');
}

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (messaging) {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || "YOUR_VAPID_KEY"
        });
        console.log('FCM Token:', token);
        return token;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = () =>
  new Promise((resolve) => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    }
  });

// Local notification helper (for browser notifications)
export const showLocalNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }
  return null;
};

// Schedule notification for a specific time
export const scheduleNotification = (title, body, scheduledTime) => {
  const now = new Date().getTime();
  const delay = scheduledTime - now;

  if (delay > 0) {
    setTimeout(() => {
      showLocalNotification(title, { body });
    }, delay);
    return true;
  }
  return false;
};

/**
 * Schedule a daily repeating notification at HH:MM local time.
 * @param {string} title
 * @param {string} body
 * @param {string} timeStr  "HH:MM" in 24-hour format
 */
export const scheduleDailyNotification = (title, body, timeStr) => {
  if (!timeStr || !('Notification' in window) || Notification.permission !== 'granted') return;

  const [hours, minutes] = timeStr.split(':').map(Number);

  const getNextFire = () => {
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    // If the time has already passed today, schedule for tomorrow
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  };

  const schedule = () => {
    const delay = getNextFire();
    setTimeout(() => {
      showLocalNotification(title, { body });
      // Re-schedule for the next day
      schedule();
    }, delay);
  };

  schedule();
};

export { db, messaging, storage };
