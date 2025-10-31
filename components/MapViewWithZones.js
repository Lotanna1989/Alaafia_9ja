// src/components/MapViewWithZones.js
import React, { useEffect, useState } from "react";
import MapView, { Polygon, Marker, Polyline } from "react-native-maps";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import MapViewDirections from "react-native-maps-directions";
import Constants from "expo-constants";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebaseConfig";  // ✅ Correct import

const apiKey = Constants.expoConfig.extra.googleMapsApiKey || "AIzaSyB5r0COdAuVbA0y_7fzZfA_H0yB2ooQXdw";

const MapViewWithZones = ({ 
  zones = { grazing: [], nonGrazing: [] }, 
  herderLocations = {}, 
  drawingMode = false, 
  drawnPoints = [], 
  drawingType = null,
  onMapPress,
  userRole = 'herder', // 'herder' or 'farmer'
  currentLocation = null,
  alertsStopped = false // NEW: Flag to stop all alerts
}) => {

  // Enhanced state for new features
  const [showDirections, setShowDirections] = useState(false);
  const [directionsOrigin, setDirectionsOrigin] = useState(null);
  const [directionsDestination, setDirectionsDestination] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [elevationData, setElevationData] = useState({});
  const [nearbyVets, setNearbyVets] = useState([]);
  const [showSolarInfo, setShowSolarInfo] = useState(false);
  const [selectedHerder, setSelectedHerder] = useState(null);
  const [routePlan, setRoutePlan] = useState([]);

  // Debug logging
  console.log('🗺️ MapViewWithZones received:', {
    grazingZones: zones.grazing?.length || 0,
    nonGrazingZones: zones.nonGrazing?.length || 0,
    herderCount: Object.keys(herderLocations).length,
    drawingMode,
    drawnPointsCount: drawnPoints.length,
    userRole,
    alertsStopped // NEW: Log alert status
  });

  // Calculate distance between two points
  const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Find nearest safe grazing zone
  const findNearestGrazingZone = (location) => {
    if (!zones.grazing || zones.grazing.length === 0) return null;
    
    let nearest = null;
    let shortestDistance = Infinity;
    
    zones.grazing.forEach((zone) => {
      // Calculate center of polygon
      const centerLat = zone.reduce((sum, coord) => sum + coord.lat, 0) / zone.length;
      const centerLng = zone.reduce((sum, coord) => sum + coord.lng, 0) / zone.length;
      
      const distance = calculateDistance(location, { latitude: centerLat, longitude: centerLng });
      
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearest = { latitude: centerLat, longitude: centerLng, distance };
      }
    });
    
    return nearest;
  };

  // Check if herder is in restricted zone
  const checkHerderViolation = (herderLocation) => {
    return zones.nonGrazing?.some(zone => {
      // Simple point-in-polygon check (you might want to use a more robust algorithm)
      return isPointInPolygon(herderLocation, zone);
    });
  };

  // Simple point-in-polygon check
  const isPointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
          (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // 🌞 Fetch Solar Radiation Data (Google Solar API)
  const fetchSolarData = async (location) => {
    try {
      const response = await fetch(
        `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${location.latitude}&location.longitude=${location.longitude}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.solarPotential) {
        setSolarData({
          maxArrayPanels: data.solarPotential.maxArrayPanelsCount,
          maxArrayArea: data.solarPotential.maxArrayAreaMeters2,
          maxSunshineHours: data.solarPotential.maxSunshineHoursPerYear,
          carbonOffset: data.solarPotential.carbonOffsetFactorKgPerMwh,
          roofSegments: data.solarPotential.roofSegmentStats || []
        });
      }
    } catch (error) {
      console.error('☀️ Solar API Error:', error);
    }
  };

  // ⛰️ Fetch Elevation Data (Google Elevation API)
  const fetchElevationData = async (locations) => {
    try {
      const locationString = locations.map(loc => `${loc.latitude},${loc.longitude}`).join('|');
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/elevation/json?locations=${locationString}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.results) {
        const elevations = {};
        data.results.forEach((result, index) => {
          elevations[`${locations[index].latitude},${locations[index].longitude}`] = {
            elevation: Math.round(result.elevation),
            resolution: result.resolution
          };
        });
        setElevationData(elevations);
      }
    } catch (error) {
      console.error('⛰️ Elevation API Error:', error);
    }
  };

  // 🏥 Find Nearby Veterinarians (Google Places API)
  const findNearbyVets = async (location) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=50000&keyword=veterinary+clinic+animal+hospital&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.results) {
        const vets = data.results.slice(0, 5).map(vet => ({
          id: vet.place_id,
          name: vet.name,
          location: {
            latitude: vet.geometry.location.lat,
            longitude: vet.geometry.location.lng
          },
          rating: vet.rating || 'N/A',
          isOpen: vet.opening_hours?.open_now || false,
          distance: calculateDistance(location, {
            latitude: vet.geometry.location.lat,
            longitude: vet.geometry.location.lng
          })
        }));
        setNearbyVets(vets);
      }
    } catch (error) {
      console.error('🏥 Places API Error:', error);
    }
  };

  // MODIFIED: Auto-redirect herder from restricted zone - ONLY if alerts not stopped
  useEffect(() => {
    if (alertsStopped) {
      console.log('🔕 Alerts are stopped - skipping violation checks');
      return; // Skip all alert logic
    }

    Object.entries(herderLocations).forEach(([herderId, location]) => {
      const herderPos = { lat: location.lat, lng: location.lon };
      
      if (checkHerderViolation(herderPos)) {
        const nearestSafeZone = findNearestGrazingZone({
          latitude: location.lat,
          longitude: location.lon
        });
        
        if (nearestSafeZone) {
          setDirectionsOrigin({ latitude: location.lat, longitude: location.lon });
          setDirectionsDestination(nearestSafeZone);
          setShowDirections(true);
          setSelectedHerder(herderId);
          
          // REMOVED: Alert.alert - No more popup alerts
          console.log(`⚠️ Violation detected for herder ${herderId} - directions set silently`);
        }
      }
    });
  }, [herderLocations, zones, alertsStopped]); // Added alertsStopped dependency

  // MODIFIED: Generate optimal route - no alerts, just silent logging
  const generateOptimalRoute = async (startLocation) => {
    if (!zones.grazing || zones.grazing.length < 2) {
      console.log('Need at least 2 grazing zones for route planning');
      return;
    }

    // Calculate centers of all grazing zones
    const grazingCenters = zones.grazing.map((zone, index) => {
      const centerLat = zone.reduce((sum, coord) => sum + coord.lat, 0) / zone.length;
      const centerLng = zone.reduce((sum, coord) => sum + coord.lng, 0) / zone.length;
      return {
        id: index,
        latitude: centerLat,
        longitude: centerLng,
        zone: zone
      };
    });

    // Sort by distance from start location
    const sortedZones = grazingCenters.sort((a, b) => {
      const distA = calculateDistance(startLocation, a);
      const distB = calculateDistance(startLocation, b);
      return distA - distB;
    });

    setRoutePlan(sortedZones.slice(0, 4)); // Show route to 4 nearest zones
    console.log(`Route planned through ${sortedZones.length} grazing zones`); // Silent logging
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 6.5244, // Benin City, Nigeria
          longitude: 5.8467,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={onMapPress}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType="hybrid"
      >
        {/* Render Grazing Zones (Green Polygons) */}
        {zones.grazing?.map((zone, index) => (
          <Polygon
            key={`grazing-${index}`}
            coordinates={zone.map(coord => ({
              latitude: coord.lat,
              longitude: coord.lng
            }))}
            strokeColor="#4CAF50"
            fillColor="rgba(76, 175, 80, 0.3)"
            strokeWidth={3}
          />
        ))}

        {/* Render Non-Grazing Zones (Red Polygons) */}
        {zones.nonGrazing?.map((zone, index) => (
          <Polygon
            key={`nongrazing-${index}`}
            coordinates={zone.map(coord => ({
              latitude: coord.lat,
              longitude: coord.lng
            }))}
            strokeColor="#f44336"
            fillColor="rgba(244, 67, 54, 0.4)"
            strokeWidth={3}
          />
        ))}

        {/* Render Herder/Cow Locations with Violation Indicators */}
        {Object.entries(herderLocations).map(([herderId, location]) => {
          const isInViolation = checkHerderViolation({ lat: location.lat, lng: location.lon });
          const elevationKey = `${location.lat},${location.lon}`;
          const elevation = elevationData[elevationKey]?.elevation;
          
          return (
            <Marker
              key={`herder-${herderId}`}
              coordinate={{
                latitude: location.lat,
                longitude: location.lon || location.lng
              }}
              title={`Herder ${herderId} ${isInViolation ? '⚠️ VIOLATION' : '✅'}`}
              description={`
                Location: ${location.lat.toFixed(4)}, ${location.lon?.toFixed(4)}
                ${elevation ? `Elevation: ${elevation}m` : ''}
                Status: ${isInViolation ? 'In restricted zone!' : 'Safe grazing area'}
                Updated: ${location.timestamp ? new Date(location.timestamp).toLocaleTimeString() : 'Unknown'}
              `}
              onPress={() => {
                setSelectedHerder(herderId);
                // Fetch elevation for this location
                fetchElevationData([{ latitude: location.lat, longitude: location.lon }]);
                // Find nearby vets
                findNearbyVets({ latitude: location.lat, longitude: location.lon });
              }}
            >
              <View style={{
                backgroundColor: isInViolation ? '#f44336' : '#FF9800',
                padding: 8,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: isInViolation ? '#fff' : '#4CAF50',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ fontSize: 16 }}>🐄</Text>
                {elevation && (
                  <Text style={{ fontSize: 8, color: 'white', fontWeight: 'bold' }}>
                    {elevation}m
                  </Text>
                )}
              </View>
            </Marker>
          );
        })}

        {/* Render Nearby Veterinarians */}
        {nearbyVets.map((vet) => (
          <Marker
            key={`vet-${vet.id}`}
            coordinate={vet.location}
            title={`🏥 ${vet.name}`}
            description={`Rating: ${vet.rating} ⭐ | Distance: ${vet.distance.toFixed(1)}km | ${vet.isOpen ? 'Open Now' : 'Closed'}`}
          >
            <View style={{
              backgroundColor: vet.isOpen ? '#4CAF50' : '#757575',
              padding: 6,
              borderRadius: 15,
              borderWidth: 2,
              borderColor: 'white'
            }}>
              <Text style={{ fontSize: 14 }}>🏥</Text>
            </View>
          </Marker>
        ))}

        {/* MODIFIED: Show Emergency Directions (only if alerts not stopped) */}
        {!alertsStopped && showDirections && directionsOrigin && directionsDestination && (
          <MapViewDirections
            origin={directionsOrigin}
            destination={directionsDestination}
            apikey={apiKey}
            strokeWidth={6}
            strokeColor="#f44336"
            optimizeWaypoints={true}
            mode="WALKING" // Better for herders on foot
            onStart={(params) => {
              console.log(`🚨 Emergency directions started for herder ${selectedHerder}`);
            }}
            onReady={(result) => {
              console.log(`🚨 Emergency route: ${result.distance.toFixed(1)}km, ${Math.round(result.duration)} min`);
              // REMOVED: Alert.alert - No more popup alerts
            }}
            onError={(errorMessage) => {
              console.error('🚨 Emergency directions error:', errorMessage);
            }}
          />
        )}

        {/* Show Optimal Route Plan */}
        {routePlan.length > 0 && routePlan.map((waypoint, index) => (
          <Marker
            key={`route-${index}`}
            coordinate={waypoint}
            title={`Route Stop ${index + 1}`}
            description={`Grazing Zone ${waypoint.id}`}
          >
            <View style={{
              backgroundColor: '#2196F3',
              padding: 8,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: 'white',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                {index + 1}
              </Text>
            </View>
          </Marker>
        ))}

        {/* Render Drawing Points (when user is drawing new zones) */}
        {drawingMode && drawnPoints.map((point, index) => (
          <Marker
            key={`drawn-${index}`}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => {
              if (userRole === 'farmer') {
                fetchSolarData(point); // Get solar data for farmers
              }
            }}
          >
            <View style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: drawingType === 'grazing' ? '#4CAF50' : '#f44336',
              borderWidth: 2,
              borderColor: 'white'
            }}>
              <Text style={{ 
                color: 'white', 
                fontSize: 8, 
                textAlign: 'center',
                lineHeight: 8
              }}>
                {index + 1}
              </Text>
            </View>
          </Marker>
        ))}

        {/* Draw lines connecting the drawn points */}
        {drawingMode && drawnPoints.length > 1 && (
          <Polyline
            coordinates={drawnPoints.map(point => ({
              latitude: point.latitude,
              longitude: point.longitude
            }))}
            strokeColor={drawingType === 'grazing' ? '#4CAF50' : '#f44336'}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* Preview the polygon being drawn (if 3+ points) */}
        {drawingMode && drawnPoints.length >= 3 && (
          <Polygon
            coordinates={drawnPoints.map(point => ({
              latitude: point.latitude,
              longitude: point.longitude
            }))}
            strokeColor={drawingType === 'grazing' ? '#4CAF50' : '#f44336'}
            fillColor={drawingType === 'grazing' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}
            strokeWidth={3}
            lineDashPattern={[15, 10]}
          />
        )}
      </MapView>

      {/* Control Panel */}
      <View style={{
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        minWidth: 200
      }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
          🛠️ Smart Controls
        </Text>
        
        {/* NEW: Alert Status Indicator */}
        {alertsStopped && (
          <View style={{
            backgroundColor: '#e8f5e8',
            padding: 6,
            borderRadius: 4,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: '#4CAF50'
          }}>
            <Text style={{ fontSize: 10, color: '#2e7d32', textAlign: 'center', fontWeight: 'bold' }}>
              🔕 All alerts stopped
            </Text>
          </View>
        )}
        
        {userRole === 'herder' && (
          <>
            <TouchableOpacity
              style={{
                backgroundColor: '#2196F3',
                padding: 8,
                borderRadius: 6,
                marginBottom: 6
              }}
              onPress={() => {
                if (currentLocation) {
                  generateOptimalRoute(currentLocation);
                } else {
                  console.log('Current location not available'); // Silent logging
                }
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>
                📍 Plan Optimal Route
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#FF9800',
                padding: 8,
                borderRadius: 6,
                marginBottom: 6
              }}
              onPress={() => {
                if (currentLocation) {
                  findNearbyVets(currentLocation);
                } else {
                  console.log('Current location not available'); // Silent logging
                }
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>
                🏥 Find Nearby Vets
              </Text>
            </TouchableOpacity>
          </>
        )}

        {userRole === 'farmer' && (
          <>
            <TouchableOpacity
              style={{
                backgroundColor: '#FF9800',
                padding: 8,
                borderRadius: 6,
                marginBottom: 6
              }}
              onPress={() => {
                if (currentLocation) {
                  fetchSolarData(currentLocation);
                  setShowSolarInfo(true);
                } else {
                  console.log('Current location not available'); // Silent logging
                }
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>
                ☀️ Check Solar Potential
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#4CAF50',
                padding: 8,
                borderRadius: 6,
                marginBottom: 6
              }}
              onPress={() => {
                if (currentLocation) {
                  fetchElevationData([currentLocation]);
                } else {
                  console.log('Current location not available'); // Silent logging
                }
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>
                ⛰️ Get Elevation Data
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: showDirections ? '#f44336' : '#757575',
            padding: 8,
            borderRadius: 6
          }}
          onPress={() => setShowDirections(!showDirections)}
        >
          <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>
            {showDirections ? '❌ Hide Directions' : '🧭 Show Directions'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Solar Data Panel (Farmers) */}
      {showSolarInfo && solarData && (
        <View style={{
          position: 'absolute',
          bottom: 120,
          right: 10,
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#FF9800',
          maxWidth: 250
        }}>
          <Text style={{ fontWeight: 'bold', color: '#FF9800', marginBottom: 8 }}>
            ☀️ Solar Analysis
          </Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            Max Panels: {solarData.maxArrayPanels}
          </Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            Max Area: {solarData.maxArrayArea}m²
          </Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            Sunshine Hours/Year: {solarData.maxSunshineHours}
          </Text>
          <Text style={{ fontSize: 12, marginBottom: 8 }}>
            Carbon Offset: {solarData.carbonOffset} kg/MWh
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#FF9800', padding: 6, borderRadius: 4 }}
            onPress={() => setShowSolarInfo(false)}
          >
            <Text style={{ color: 'white', fontSize: 10, textAlign: 'center' }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Zone Legend */}
      <View style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd'
      }}>
        <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
          🗺️ Map Legend
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <View style={{
            width: 12, height: 12, backgroundColor: 'rgba(76, 175, 80, 0.6)',
            marginRight: 6, borderRadius: 2
          }} />
          <Text style={{ fontSize: 10 }}>Grazing Areas</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <View style={{
            width: 12, height: 12, backgroundColor: 'rgba(244, 67, 54, 0.6)',
            marginRight: 6, borderRadius: 2
          }} />
          <Text style={{ fontSize: 10 }}>Non-grazing Areas</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <Text style={{ fontSize: 12, marginRight: 6 }}>🐄</Text>
          <Text style={{ fontSize: 10 }}>Cow Locations</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, marginRight: 6 }}>🏥</Text>
          <Text style={{ fontSize: 10 }}>Veterinarians</Text>
        </View>
      </View>

      {/* Status Info */}
      <View style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 8,
        borderRadius: 8,
        minWidth: 100
      }}>
        <Text style={{ color: 'white', fontSize: 10 }}>
          📊 Status
        </Text>
        <Text style={{ color: '#4CAF50', fontSize: 10 }}>
          Grazing: {zones.grazing?.length || 0}
        </Text>
        <Text style={{ color: '#f44336', fontSize: 10 }}>
          Restricted: {zones.nonGrazing?.length || 0}
        </Text>
        <Text style={{ color: '#FF9800', fontSize: 10 }}>
          Herders: {Object.keys(herderLocations).length}
        </Text>
        <Text style={{ color: '#2196F3', fontSize: 10 }}>
          Vets: {nearbyVets.length}
        </Text>
        {alertsStopped && (
          <Text style={{ color: '#4CAF50', fontSize: 10 }}>
            🔕 Alerts OFF
          </Text>
        )}
        {!alertsStopped && showDirections && (
          <Text style={{ color: '#f44336', fontSize: 10 }}>
            🚨 Emergency Route
          </Text>
        )}
      </View>
    </View>
  );
};

export default MapViewWithZones;