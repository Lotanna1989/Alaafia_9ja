// src/screens/farmer/FarmerDashboard.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from "expo-location";
import MapViewWithZones from '../../components/MapViewWithZones';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { subscribeToZones, subscribeToCowLocations } from '../../services/firebaseService';
import { getZoneViolationDetails } from '../../utils/geoUtils';
import { playAlertSound, speakAlert } from '../../utils/alertUtils';
import { handleTreePlanting } from '../../services/treeService';



const FarmerDashboard = () => {
  const [zones, setZones] = useState({ grazing: [], nonGrazing: [] });
  const [zonesLoading, setZonesLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [cowLocations, setCowLocations] = useState({});
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingType, setDrawingType] = useState(null);
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [image, setImage] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState(null);

  const firebaseSync = useFirebaseSync({
    role: 'farmer',
    userId: 'farmer_001',
  });

  console.log('🌾 FarmerDashboard State:', {
    zonesLoading,
    locationLoading,
    currentLocation: !!currentLocation,
    zonesCount: {
      grazing: zones.grazing?.length || 0,
      nonGrazing: zones.nonGrazing?.length || 0
    },
    error
  });

  // 📍 Get farmer's current location with better error handling
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        console.log('📍 Requesting location permission...');
        setLocationLoading(true);
        
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log('📍 Permission status:', status);
        
        if (status !== 'granted') {
          console.error('📍 Location permission denied');
          setError('Location permission denied');
          // Set a default location for testing
          setCurrentLocation({
            latitude: 6.5244, // Benin City default
            longitude: 5.8467,
          });
          setLocationLoading(false);
          return;
        }

        console.log('📍 Getting current position...');
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 15000, // 15 second timeout
        });
        
        console.log('📍 Location received:', location.coords);
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setLocationLoading(false);
        
      } catch (locationError) {
        console.error('📍 Location error:', locationError);
        setError(`Location error: ${locationError.message}`);
        
        // Fallback to default location
        setCurrentLocation({
          latitude: 6.5244, // Benin City default
          longitude: 5.8467,
        });
        setLocationLoading(false);
      }
    };

    getCurrentLocation();
  }, []);

  // 📡 Sync zones + cow locations with better error handling (NO AUTO ALERTS)
  useEffect(() => {
    console.log('📡 Setting up Firebase subscriptions...');
    
    try {
      const unsubZones = subscribeToZones((zonesData) => {
        console.log('📡 Zones data received:', {
          grazing: zonesData.grazing?.length || 0,
          nonGrazing: zonesData.nonGrazing?.length || 0
        });
        setZones(zonesData);
        setZonesLoading(false);
      }, (zoneError) => {
        console.error('📡 Zones subscription error:', zoneError);
        setError(`Zones error: ${zoneError.message}`);
        setZonesLoading(false);
        // Set empty zones to prevent infinite loading
        setZones({ grazing: [], nonGrazing: [] });
      });

      const unsubCowLocations = subscribeToCowLocations((locations) => {
        console.log('📡 Cow locations received:', Object.keys(locations).length);
        setCowLocations(locations);
        
        // 🚫 REMOVED: No automatic violation checking and alerts for farmers
        // Farmers can see violations on the map but don't get bombarded with alerts
        // Only herders should get violation alerts when they manually check
        
      }, (cowError) => {
        console.error('📡 Cow locations subscription error:', cowError);
        // Don't set error here as cow locations are not critical for loading
      });

      return () => {
        console.log('📡 Cleaning up Firebase subscriptions...');
        if (typeof unsubZones === 'function') unsubZones();
        if (typeof unsubCowLocations === 'function') unsubCowLocations();
      };
    } catch (subscriptionError) {
      console.error('📡 Subscription setup error:', subscriptionError);
      setError(`Subscription error: ${subscriptionError.message}`);
      setZonesLoading(false);
      setZones({ grazing: [], nonGrazing: [] });
    }
  }, [zones.grazing?.length, zones.nonGrazing?.length]); // Add dependency to prevent infinite loops

  // Add timeout for loading states
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (zonesLoading || locationLoading) {
        console.warn('⏱️ Loading timeout reached, forcing continue...');
        setZonesLoading(false);
        setLocationLoading(false);
        if (!currentLocation) {
          setCurrentLocation({
            latitude: 6.5244, // Benin City default
            longitude: 5.8467,
          });
        }
        if (!zones.grazing && !zones.nonGrazing) {
          setZones({ grazing: [], nonGrazing: [] });
        }
      }
    }, 20000); // 20 second timeout

    return () => clearTimeout(timeout);
  }, [zonesLoading, locationLoading, currentLocation, zones]);

  const handleMapPress = (e) => {
    if (drawingMode && drawingType) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setDrawnPoints([...drawnPoints, { latitude, longitude }]);
    }
  };

  const handleSaveZone = async () => {
    if (!drawingType || drawnPoints.length < 3) {
      Alert.alert('Invalid', 'Draw at least 3 points.');
      return;
    }
    try {
      const points = drawnPoints.map(p => ({ lat: p.latitude, lng: p.longitude }));
      await firebaseSync.saveZone(drawingType, points);
      setDrawingMode(false);
      setDrawingType(null);
      setDrawnPoints([]);
      Alert.alert('Success', 'Zone saved successfully!');
    } catch (saveError) {
      console.error('💾 Save zone error:', saveError);
      Alert.alert('Error', `Failed to save zone: ${saveError.message}`);
    }
  };

  const handlePlantTree = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission denied');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ base64: false });
      if (!result.cancelled) {
        setImage(result.uri);
        await handleTreePlanting('farmer_001', result);
        Alert.alert('Success', 'Tree planted and tokens awarded!');
      }
    } catch (err) {
      console.error('🌳 Tree planting error:', err);
      Alert.alert('Error', err.message || 'Something went wrong.');
    }
  };

  // Show error state
  if (error && zonesLoading && locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setZonesLoading(true);
            setLocationLoading(true);
            // Force reload
            window.location?.reload?.();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={() => {
            setError(null);
            setZonesLoading(false);
            setLocationLoading(false);
            if (!currentLocation) {
              setCurrentLocation({
                latitude: 6.5244,
                longitude: 5.8467,
              });
            }
            if (!zones.grazing && !zones.nonGrazing) {
              setZones({ grazing: [], nonGrazing: [] });
            }
          }}
        >
          <Text style={styles.continueButtonText}>Continue Anyway</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading state
  if (zonesLoading || locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="green" />
        <Text style={styles.loadingText}>Loading map data...</Text>
        <Text style={styles.debugText}>
          Location: {locationLoading ? 'Loading...' : '✅ Ready'}
        </Text>
        <Text style={styles.debugText}>
          Zones: {zonesLoading ? 'Loading...' : '✅ Ready'}
        </Text>
        {error && (
          <Text style={styles.debugError}>Error: {error}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🌾 Farmer Dashboard</Text>
      
      {/* Map Container */}
      <View style={styles.mapContainer}>
        <MapViewWithZones
          zones={zones}
          herderLocations={cowLocations}
          drawingMode={drawingMode}
          drawnPoints={drawnPoints}
          drawingType={drawingType}
          onMapPress={handleMapPress}
          userRole="farmer"
          currentLocation={currentLocation}
        />
      </View>

      {/* Debug Info */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>🐛 Debug Info</Text>
          <Text style={styles.debugText}>Location: {currentLocation ? '✅' : '❌'}</Text>
          <Text style={styles.debugText}>
            Zones: G{zones.grazing?.length || 0} / NG{zones.nonGrazing?.length || 0}
          </Text>
          <Text style={styles.debugText}>Herders: {Object.keys(cowLocations).length}</Text>
          <Text style={styles.debugText}>No Auto-Alerts: ✅</Text>
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {!drawingMode ? (
          <>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setDrawingMode(true);
                setDrawingType('grazing');
              }}
            >
              <Text style={styles.buttonText}>Draw Grazing Zone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setDrawingMode(true);
                setDrawingType('nonGrazing');
              }}
            >
              <Text style={styles.buttonText}>Draw Non-Grazing Zone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={handlePlantTree}
            >
              <Text style={styles.buttonText}>🌳 Plant Tree</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={handleSaveZone}
          >
            <Text style={styles.buttonText}>✅ Save Zone</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FarmerDashboard;

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  debugError: {
    fontSize: 12,
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: 'orange',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 120,
  },
  retryButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: 'gray',
    padding: 15,
    borderRadius: 8,
    minWidth: 120,
  },
  continueButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  debugContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 5,
  },
  debugTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    margin: 10,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    height: 500,
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonContainer: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  button: {
    backgroundColor: 'green',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});