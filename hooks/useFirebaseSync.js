// src/hooks/useFirebaseSync.js
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { uploadCowLocation, saveZoneToFirebase } from '../services/firebaseService';

export const useFirebaseSync = ({ role, userId, cowId, alertsStopped = false, zones = {}, onAlert }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [locationHistory, setLocationHistory] = useState([]);
  const [totalTokens, setTotalTokens] = useState(0);

  useEffect(() => {
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });

    let locationInterval;

    if (role === 'herder' && isOnline) {
      locationInterval = setInterval(async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;

          const loc = await Location.getCurrentPositionAsync({});
          const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };

          await uploadCowLocation({ userId, cowId, ...coords });
        } catch (error) {
          console.error('📍 Error uploading herder location:', error);
        }
      }, 5000); // Every 5 seconds
    }

    return () => {
      unsubscribeNetInfo();
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [isOnline]);

  // Add this method so Farmer can save drawn zones
  const saveZone = async (zoneType, coordinates) => {
    try {
      await saveZoneToFirebase(zoneType, coordinates);
    } catch (error) {
      console.error('🔥 Error saving zone to Firebase:', error);
    }
  };

  const getTotalTokens = () => {
    // Placeholder logic, can be replaced with actual token fetching
    return 0;
  };

  return {
    isOnline,
    getTotalTokens,
    saveZone, // make sure it's exposed!
  };
};
