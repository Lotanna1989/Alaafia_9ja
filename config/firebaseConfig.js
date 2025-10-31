// src/config/firebaseConfig.js

import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import {

  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Required for persistence

const firebaseConfig = {
  apiKey: "AIzaSyDESQeEbFFKTfj5OmH0u-XyrE-hOQMlSsc",
  authDomain: "livestock-monitor-94ce0.firebaseapp.com",
  databaseURL: "https://livestock-monitor-94ce0-default-rtdb.firebaseio.com",
  projectId: "livestock-monitor-94ce0",
  storageBucket: "livestock-monitor-94ce0.appspot.com", // 🔧 corrected domain
  messagingSenderId: "764405233112",
  appId: "1:764405233112:web:70aa10e8cf98776426eead",
  measurementId: "G-2NL2MWNKJW",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Initialize Firestore (no change needed)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// ✅ Initialize Auth with AsyncStorage for persistence

export { db };
export default app;
