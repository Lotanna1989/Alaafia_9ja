import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TouchableWithoutFeedback, Alert, Modal, TextInput } from 'react-native';
import * as Location from "expo-location";
import MapViewWithZones from '../../components/MapViewWithZones';
import TokenStats from "../../components/TokenStats";
import WalletDisplay from "../../components/WalletDisplay";

import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { subscribeToZones, subscribeToCowLocations, saveZoneToFirebase, updateHerderPoints, recordDungSale } from '../../services/firebaseService';
import { playAlertSound, speakAlert, showPopupAlert } from '../../utils/alertUtils';

const HerderDashboard = () => {
  const [zones, setZones] = useState({ grazing: [], nonGrazing: [] });
  const [zonesLoading, setZonesLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [cowLocations, setCowLocations] = useState({}); 
  const [currentLocation, setCurrentLocation] = useState(null); 
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingType, setDrawingType] = useState(null); 
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); 
  const [alertsStopped, setAlertsStopped] = useState(false); // NEW: Track if alerts are stopped

  // Point system states
  const [herderPoints, setHerderPoints] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [availableDung, setAvailableDung] = useState(0);

  const userId = 'herder_001';  
  const cowId = 'cow_001';      
  const wallet = '0x1234...5678'; 

  // Point system configuration (simplified - no violation penalties)
  const POINT_REWARDS = {
    AVOID_VIOLATION_DAILY: 10,    
    ZONE_COMPLIANCE_HOURLY: 2,    
    STREAK_BONUS: 5,              
    DUNG_SALE_COMPOST: 15,        
    DUNG_SALE_BIOGAS: 20,         
  };

  console.log('🐄 HerderDashboard State:', {
    zonesLoading,
    locationLoading,
    currentLocation: !!currentLocation,
    cowLocationsCount: Object.keys(cowLocations).length,
    zonesCount: {
      grazing: zones.grazing?.length || 0,
      nonGrazing: zones.nonGrazing?.length || 0
    },
    error,
    herderPoints,
    streakDays,
    alertsStopped
  });

  // NEW: Function to stop all alerts when screen is pressed
  const handleScreenPress = () => {
    console.log('🛑 Screen pressed - Stopping all alerts permanently');
    setAlertsStopped(true);
  };

  // Robust location fetching with retry logic
  const getCurrentLocationWithRetry = async (maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📍 Location attempt ${attempt}/${maxRetries}`);
        
        const isEnabled = await Location.hasServicesEnabledAsync();
        if (!isEnabled) {
          throw new Error('Location services are disabled');
        }
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission was denied');
        }
        
        const accuracy = attempt === 1 ? Location.Accuracy.Balanced : 
                        attempt === 2 ? Location.Accuracy.Low : 
                        Location.Accuracy.Lowest;
        
        const locationResult = await Location.getCurrentPositionAsync({
          accuracy,
          timeout: 10000 + (attempt * 5000), 
          maximumAge: 30000, 
        });
        
        if (locationResult && locationResult.coords) {
          console.log(`📍 Location success on attempt ${attempt}:`, locationResult.coords);
          return {
            latitude: locationResult.coords.latitude,
            longitude: locationResult.coords.longitude,
          };
        } else {
          throw new Error('Invalid location result received');
        }
        
      } catch (error) {
        console.error(`📍 Location attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          try {
            console.log('📍 Trying to get last known location...');
            const lastLocation = await Location.getLastKnownPositionAsync({
              maxAge: 300000,
              requiredAccuracy: 1000,
            });
            
            if (lastLocation && lastLocation.coords) {
              console.log('📍 Using last known location:', lastLocation.coords);
              return {
                latitude: lastLocation.coords.latitude,
                longitude: lastLocation.coords.longitude,
              };
            }
          } catch (lastLocationError) {
            console.error('📍 Last known location failed:', lastLocationError.message);
          }
          
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  };

  // Get herder's current location with improved error handling
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        console.log('📍 Initializing location...');
        setLocationLoading(true);
        setError(null);
        
        const location = await getCurrentLocationWithRetry(3);
        
        console.log('📍 Final location set:', location);
        setCurrentLocation(location);
        
      } catch (locationError) {
        console.error('📍 All location attempts failed:', locationError.message);
        
        const errorMessage = locationError.message.includes('denied') 
          ? 'Location permission denied. Using default location.'
          : locationError.message.includes('disabled')
          ? 'Location services disabled. Using default location.'
          : `Location unavailable: ${locationError.message}. Using default location.`;
        
        setError(errorMessage);
        
        console.log('📍 Setting fallback location');
        setCurrentLocation({
          latitude: 6.5244, // Benin City, Nigeria
          longitude: 5.8467,
        });
        
      } finally {
        setLocationLoading(false);
      }
    };

    initializeLocation();
  }, []);

  // Manual location refresh function
  const refreshLocation = async () => {
    try {
      setLocationLoading(true);
      setError(null);
      
      const location = await getCurrentLocationWithRetry(2);
      setCurrentLocation(location);
      
      console.log('Location refreshed successfully');
      
    } catch (error) {
      console.error('📍 Manual location refresh failed:', error);
      setError(`Location refresh failed: ${error.message}`);
    } finally {
      setLocationLoading(false);
    }
  };

  // Fetch zones and herder data from Firebase
  useEffect(() => {
    console.log('📡 Fetching zones and herder data from Firebase...');

    try {
      const unsubscribeZones = subscribeToZones((zonesData) => {
        console.log('📡 Zones received from Firebase:', {
          grazing: zonesData.grazing?.length || 0,
          nonGrazing: zonesData.nonGrazing?.length || 0
        });
        setZones(zonesData);
        setZonesLoading(false);
      }, (zoneError) => {
        console.error('📡 Zones subscription error:', zoneError);
        setError(`Zones error: ${zoneError.message}`);
        setZonesLoading(false);
        setZones({ grazing: [], nonGrazing: [] });
      });

      const unsubscribeCowLocations = subscribeToCowLocations((locations) => {
        console.log('📡 Cow locations received:', Object.keys(locations).length);
        setCowLocations(locations);
      }, (cowError) => {
        console.error('📡 Cow locations subscription error:', cowError);
      });

      loadHerderData();

      // Set up daily dung accumulation
      const dungInterval = setInterval(() => {
        setAvailableDung(prev => prev + Math.floor(Math.random() * 3) + 1); 
      }, 3600000); // Every hour

      // Daily streak check
      const streakInterval = setInterval(() => {
        checkDailyStreak();
      }, 86400000); // Every 24 hours

      return () => {
        console.log('📡 Cleaning up Firebase subscriptions...');
        if (typeof unsubscribeZones === 'function') unsubscribeZones();
        if (typeof unsubscribeCowLocations === 'function') unsubscribeCowLocations();
        clearInterval(dungInterval);
        clearInterval(streakInterval);
      };
    } catch (subscriptionError) {
      console.error('📡 Subscription setup error:', subscriptionError);
      setError(`Subscription error: ${subscriptionError.message}`);
      setZonesLoading(false);
      setZones({ grazing: [], nonGrazing: [] });
    }
  }, []);

  // Add timeout for loading states
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (zonesLoading || locationLoading) {
        console.warn('⏱️ Loading timeout reached, forcing continue...');
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
      }
    }, 20000); // 20 second timeout

    return () => clearTimeout(timeout);
  }, [zonesLoading, locationLoading, currentLocation, zones]);

  // Load herder data from Firebase
  const loadHerderData = async () => {
    try {
      const savedData = {
        points: 150, 
        streak: 3,   
        availableDung: 25, 
      };

      setHerderPoints(savedData.points);
      setStreakDays(savedData.streak);
      setAvailableDung(savedData.availableDung);
    } catch (error) {
      console.error('Error loading herder data:', error);
    }
  };

  // Check daily streak and award points (silent)
  const checkDailyStreak = async () => {
    const today = new Date().toDateString();
    
    // Award daily compliance points (no violation checking)
    const dailyPoints = POINT_REWARDS.AVOID_VIOLATION_DAILY + (streakDays * POINT_REWARDS.STREAK_BONUS);
    await awardPoints(dailyPoints, 'Daily activity bonus');
    setStreakDays(prev => prev + 1);
  };

  // Award points to herder (silent)
  const awardPoints = async (points, reason) => {
    const newPoints = herderPoints + points;
    setHerderPoints(newPoints);

    try {
      console.log(`Points updated: ${newPoints} for ${reason}`);
      // Silent point update - no alerts, modals, or violation penalties
    } catch (error) {
      console.error('Error updating points:', error);
    }
  };

  // Handle dung sale (silent confirmation)
  const handleDungSale = async (saleType) => {
    if (availableDung < 10) {
      console.log('Not enough dung for sale');
      return;
    }

    const quantity = Math.min(availableDung, saleType === 'compost' ? 20 : 30);
    const pricePerKg = saleType === 'compost' ? 50 : 60;
    const price = quantity * pricePerKg;
    const pointsPerKg = saleType === 'compost' ? POINT_REWARDS.DUNG_SALE_COMPOST : POINT_REWARDS.DUNG_SALE_BIOGAS;
    const totalPoints = Math.floor(quantity * pointsPerKg / 10);

    try {
      // Update dung inventory
      setAvailableDung(prev => prev - quantity);
      
      // Award points
      await awardPoints(totalPoints, `Dung sale (${saleType})`);
      
      console.log('Dung sale completed:', { quantity, price, saleType, points: totalPoints });
      
    } catch (error) {
      console.error('Error recording dung sale:', error);
    }
  };

  // Hourly activity points (no compliance checking)
  useEffect(() => {
    const activityInterval = setInterval(() => {
      const activityPoints = POINT_REWARDS.ZONE_COMPLIANCE_HOURLY;
      awardPoints(activityPoints, 'Hourly activity points');
    }, 3600000); // Every hour

    return () => clearInterval(activityInterval);
  }, []);

  // MODIFIED: Start background tracking - no alert/violation handlers, respect alertsStopped flag
  const firebaseSync = useFirebaseSync({
    role: 'herder',
    userId,
    cowId,
    zones,
    alertsStopped, // Pass the alertsStopped flag to useFirebaseSync
    // Removed all alert/violation handlers
  });

  // Drawing functions
  const startDrawing = (type) => {
    setDrawingType(type);
    setDrawingMode(true);
    setDrawnPoints([]);
    console.log(`Started drawing ${type} zone`);
  };

  const onMapPress = (e) => {
    if (drawingMode && drawingType) {
      const coordinate = {
        latitude: e.nativeEvent.coordinate.latitude,
        longitude: e.nativeEvent.coordinate.longitude
      };
      const newPoints = [...drawnPoints, coordinate];
      setDrawnPoints(newPoints);

      console.log(`Drawing point added: ${newPoints.length} total points`);

      // Auto-save after 3 points
      if (newPoints.length >= 3) {
        saveDrawnZone(newPoints);
      }
    }
  };

  const saveDrawnZone = async (points) => {
    if (points.length < 3) {
      console.log('Need at least 3 points to create a zone');
      return;
    }

    setSaving(true);
    try {
      const firestoreCoords = points.map(coord => ({
        lat: coord.latitude,
        lng: coord.longitude
      }));

      const zoneType = drawingType === 'grazing' ? 'grazing' : 'non-grazing';

      await saveZoneToFirebase(zoneType, firestoreCoords);
      await awardPoints(25, `Created ${zoneType} zone`);

      console.log(`${drawingType} zone saved successfully! +25 points earned`);
      cancelDrawing();
    } catch (error) {
      console.error('❌ Error saving zone:', error);
    } finally {
      setSaving(false);
    }
  };

  const cancelDrawing = () => {
    setDrawingMode(false);
    setDrawingType(null);
    setDrawnPoints([]);
    console.log('Drawing cancelled');
  };

  // Force continue past errors
  const forceContinue = () => {
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
  };

  // Show error state with retry buttons
  if (error && zonesLoading && locationLoading) {
    return (
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <View style={[styles.container, styles.loadingContainer]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setZonesLoading(true);
              setLocationLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={forceContinue}
          >
            <Text style={styles.continueButtonText}>Continue Anyway</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // Show loading
  if (zonesLoading || locationLoading) {
    return (
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading zones from Firebase...</Text>
          <Text style={styles.subText}>
            Location: {locationLoading ? 'Loading...' : '✅ Ready'}
          </Text>
          <Text style={styles.subText}>
            Zones: {zonesLoading ? 'Loading...' : '✅ Ready'}
          </Text>
          <Text style={styles.subText}>Network: {firebaseSync?.isOnline ? '🟢 Online' : '🔴 Offline'}</Text>
          {error && (
            <Text style={styles.debugError}>Error: {error}</Text>
          )}
          
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={forceContinue}
          >
            <Text style={styles.skipButtonText}>Skip Loading</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleScreenPress}>
      <View style={styles.container}>
        <Text style={styles.header}>🐄 Herder Dashboard</Text>

        {/* NEW: Alert Status Indicator */}
        {alertsStopped && (
          <View style={styles.alertStoppedBanner}>
            <Text style={styles.alertStoppedText}>🔕 All alerts stopped - Tap anywhere to keep them off</Text>
          </View>
        )}

        {/* Location Refresh Button */}
        <TouchableOpacity
          style={styles.refreshLocationButton}
          onPress={refreshLocation}
          disabled={locationLoading}
        >
          <Text style={styles.refreshLocationText}>
            📍 {locationLoading ? 'Getting Location...' : 'Refresh Location'}
          </Text>
        </TouchableOpacity>

        {/* Show any current error inline */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
            <TouchableOpacity 
              style={styles.clearErrorButton}
              onPress={() => setError(null)}
            >
              <Text style={styles.clearErrorText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Points Display */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeader}>
            <Text style={styles.pointsTitle}>🏆 Your Points</Text>
            <Text style={styles.pointsValue}>{herderPoints}</Text>
          </View>
          <View style={styles.pointsStats}>
            <Text style={styles.statText}>🔥 Streak: {streakDays} days</Text>
            <Text style={styles.statText}>💩 Dung: {availableDung}kg</Text>
          </View>
        </View>

        {/* Dung Sale Buttons */}
        <View style={styles.dungSaleContainer}>
          <TouchableOpacity
            style={[styles.dungSaleButton, styles.compostSaleButton]}
            onPress={() => handleDungSale('compost')}
            disabled={availableDung < 10}
          >
            <Text style={styles.dungSaleButtonText}>
              🌱 Sell to Farmer (₦50/kg)
            </Text>
            <Text style={styles.dungSaleSubText}>
              {availableDung < 10 ? 'Need 10kg' : `Sell ${Math.min(availableDung, 20)}kg`}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.dungSaleButton, styles.biogasSaleButton]}
            onPress={() => handleDungSale('biogas')}
            disabled={availableDung < 10}
          >
            <Text style={styles.dungSaleButtonText}>
              ⚡ Sell to Biogas (₦60/kg)
            </Text>
            <Text style={styles.dungSaleSubText}>
              {availableDung < 10 ? 'Need 10kg' : `Sell ${Math.min(availableDung, 30)}kg`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status indicators */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            📍 Zones: {zones.grazing.length + zones.nonGrazing.length} loaded
          </Text>
          <Text style={styles.statusText}>
            {firebaseSync?.isOnline ? '🟢 Online' : '🔴 Offline'}
          </Text>
          <Text style={styles.statusText}>
            🪙 Tokens: {firebaseSync?.getTotalTokens() || 0}
          </Text>
        </View>

        {/* Drawing Controls */}
        {!drawingMode ? (
          <View style={styles.drawingControls}>
            <TouchableOpacity
              style={[styles.drawButton, styles.grazingButton]}
              onPress={() => startDrawing('grazing')}
            >
              <Text style={styles.buttonText}>🟢 Draw Grazing Area</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.drawButton, styles.nonGrazingButton]}
              onPress={() => startDrawing('nonGrazing')}
            >
              <Text style={styles.buttonText}>🔴 Draw Non-Grazing Area</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.drawingControls}>
            <Text style={styles.drawingText}>
              Drawing {drawingType} area... ({drawnPoints.length} points) 
              {drawnPoints.length >= 3 && ' - Auto-saving...'}
            </Text>
            <View style={styles.drawingButtonRow}>
              <TouchableOpacity
                style={[styles.drawButton, styles.cancelButton]}
                onPress={cancelDrawing}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawButton, styles.saveButton]}
                onPress={() => saveDrawnZone(drawnPoints)}
                disabled={saving || drawnPoints.length < 3}
              >
                <Text style={styles.buttonText}>
                  {saving ? 'Saving...' : drawnPoints.length < 3 ? 'Need 3 Points' : 'Save Zone'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Debug Info */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>🐛 Debug Info</Text>
            <Text style={styles.debugText}>Location: {currentLocation ? '✅' : '❌'}</Text>
            <Text style={styles.debugText}>
              Zones: G{zones.grazing?.length || 0} / NG{zones.nonGrazing?.length || 0}
            </Text>
            <Text style={styles.debugText}>Cows: {Object.keys(cowLocations).length}</Text>
            <Text style={styles.debugText}>Points: {herderPoints}</Text>
            <Text style={styles.debugText}>Alerts: {alertsStopped ? '🔕 OFF' : '🔔 ON'}</Text>
          </View>
        )}

        <View style={styles.mapContainer}>
          <MapViewWithZones
            zones={zones}
            herderLocations={cowLocations} 
            onMapPress={onMapPress}
            drawingMode={drawingMode}
            drawnPoints={drawnPoints}
            drawingType={drawingType}
            userRole="herder"
            currentLocation={currentLocation} 
            alertsStopped={alertsStopped} // Pass alertsStopped to MapViewWithZones
          />
        </View>

        <View style={styles.bottomStats}>
          <TokenStats userId={userId} />
          <WalletDisplay wallet={wallet} />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default HerderDashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    color: 'red',
    fontSize: 12,
    flex: 1,
  },
  clearErrorButton: {
    backgroundColor: 'red',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearErrorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // NEW: Alert stopped banner styles
  alertStoppedBanner: {
    backgroundColor: '#e8f5e8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  alertStoppedText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
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
    marginBottom: 10,
  },
  continueButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  skipButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 120,
  },
  skipButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
  },
  debugContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 5,
    zIndex: 1000,
  },
  debugTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
  },
  debugError: {
    fontSize: 12,
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  refreshLocationButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  refreshLocationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pointsCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  pointsStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  dungSaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  dungSaleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  compostSaleButton: {
    backgroundColor: '#4CAF50',
  },
  biogasSaleButton: {
    backgroundColor: '#2196F3',
  },
  dungSaleButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dungSaleSubText: {
    color: 'white',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  subText: {
    marginTop: 5,
    fontSize: 14,
    color: '#888',
  },
  drawingControls: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  drawingButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  drawButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  grazingButton: {
    backgroundColor: '#4CAF50',
    marginBottom: 10,
  },
  nonGrazingButton: {
    backgroundColor: '#f44336',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  drawingText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  mapContainer: {
    flex: 1,
    marginBottom: 10,
  },
  bottomStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});