/// src/utils/geoUtils.js - FIXED VERSION

 /**
  * 🧮 Check if a point is inside a polygon using ray casting algorithm
  * @param {Object} point - {lat, lng}
  * @param {Array} polygon - Array of {lat, lng} coordinates
  * @returns {boolean}
  */
 export const isPointInPolygon = (point, polygon) => {
   if (!point || !polygon || polygon.length < 3) {
     console.log('❌ Invalid polygon data:', { point, polygon });
     return false;
   }

   const { lat, lng } = point;
   let inside = false;

   for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
     const pi = polygon[i];
     const pj = polygon[j];

     // Handle different coordinate formats
     const pi_lat = pi.lat ?? pi.latitude;
     const pi_lng = pi.lng ?? pi.longitude;
     const pj_lat = pj.lat ?? pj.latitude;
     const pj_lng = pj.lng ?? pj.longitude;

     if (!pi_lat || !pi_lng || !pj_lat || !pj_lng) {
       console.warn('❌ Invalid polygon coordinates:', { pi, pj });
       continue;
     }

     if (((pi_lat > lat) !== (pj_lat > lat)) &&
         (lng < (pj_lng - pi_lng) * (lat - pi_lat) / (pj_lat - pi_lat) + pi_lng)) {
       inside = !inside;
     }
   }

   console.log('🔍 Point in polygon check:', { point, polygon: polygon.slice(0, 2), inside });
   return inside;
 };

 /**
  * 🎯 Check if a point is inside any of the zones
  * @param {Object} point - {lat, lng}
  * @param {Array} zones - Array of zone polygons
  * @returns {boolean}
  */
 export const isInsideZone = (point, zones) => {
   if (!point || !zones || !Array.isArray(zones)) {
     console.log('❌ Invalid zone data:', { point, zones });
     return false;
   }

   console.log('🔍 Checking zones:', { point, zoneCount: zones.length });

   // Check each zone polygon
   for (let i = 0; i < zones.length; i++) {
     const zone = zones[i];
     console.log(`🔍 Checking zone ${i}:`, zone);

     if (Array.isArray(zone) && zone.length >= 3) {
       if (isPointInPolygon(point, zone)) {
         console.log('✅ Point is inside zone:', { point, zoneIndex: i });
         return true;
       }
     } else {
       console.warn('❌ Invalid zone format:', zone);
     }
   }

   console.log('❌ Point not in any zone');
   return false;
 };

 /**
  * 📏 Calculate distance between two points (Haversine formula)
  * @param {Object} point1 - {lat, lng}
  * @param {Object} point2 - {lat, lng}
  * @returns {number} Distance in meters
  */
 export const calculateDistance = (point1, point2) => {
   const R = 6371e3; // Earth's radius in meters
   const φ1 = point1.lat * Math.PI / 180;
   const φ2 = point2.lat * Math.PI / 180;
   const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
   const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

   const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
     Math.cos(φ1) * Math.cos(φ2) *
     Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

   return R * c;
 };

 /**
  * 🔍 Find the closest zone to a point
  * @param {Object} point - {lat, lng}
  * @param {Array} zones - Array of zone polygons
  * @returns {Object|null} Closest zone data
  */
 export const findClosestZone = (point, zones) => {
   if (!point || !zones || !Array.isArray(zones)) {
     return null;
   }

   let closestZone = null;
   let minDistance = Infinity;

   zones.forEach((zone, index) => {
     if (Array.isArray(zone) && zone.length >= 3) {
       // Calculate distance to zone center
       const centerLat = zone.reduce((sum, p) => sum + (p.lat ?? p.latitude), 0) / zone.length;
       const centerLng = zone.reduce((sum, p) => sum + (p.lng ?? p.longitude), 0) / zone.length;
       const zoneCenter = { lat: centerLat, lng: centerLng };

       const distance = calculateDistance(point, zoneCenter);
       if (distance < minDistance) {
         minDistance = distance;
         closestZone = { zone, index, distance };
       }
     }
   });

   return closestZone;
 };

 /**
  * 🎯 Get zone violation details - FIXED VERSION
  * @param {Object} point - Current location {lat, lng}
  * @param {Object} zones - {grazing: [], nonGrazing: []}
  * @returns {Object} Violation details
  */
 export const getZoneViolationDetails = (point, zones) => {
   const result = {
     isInGrazingZone: false,
     isInNonGrazingZone: false,
     violation: null,
     closestSafeZone: null,
     message: null
   };

   if (!point || !zones) {
     console.log('❌ Missing point or zones data');
     return result;
   }

   console.log('🔍 Zone violation check:', { point, zones: getZoneStats(zones) });

   // Check if in grazing zone
   if (zones.grazing && Array.isArray(zones.grazing) && zones.grazing.length > 0) {
     result.isInGrazingZone = isInsideZone(point, zones.grazing);
     console.log('🟢 Grazing zone check:', result.isInGrazingZone);
   }

   // Check if in non-grazing zone
   if (zones.nonGrazing && Array.isArray(zones.nonGrazing) && zones.nonGrazing.length > 0) {
     result.isInNonGrazingZone = isInsideZone(point, zones.nonGrazing);
     console.log('🔴 Non-grazing zone check:', result.isInNonGrazingZone);
   }

   // Determine violation
   if (result.isInNonGrazingZone) {
     console.log('🚨 NON-GRAZING VIOLATION DETECTED!');
     result.violation = {
       type: 'NON_GRAZING_BREACH',
       severity: 'HIGH',
       message: 'You are in a restricted non-grazing area!',
       action: 'Move to a safe grazing area immediately'
     };

     // Find closest safe zone
     if (zones.grazing && Array.isArray(zones.grazing) && zones.grazing.length > 0) {
       result.closestSafeZone = findClosestZone(point, zones.grazing);
     }

     if (result.closestSafeZone) {
       result.message = `Move ${Math.round(result.closestSafeZone.distance)}m to nearest safe zone`;
     } else {
       result.message = 'Move to a safe grazing area immediately';
     }
   } else if (result.isInGrazingZone) {
     result.message = 'You are in a safe grazing area';
   } else {
     result.message = 'You are in an undesignated area';
   }

   console.log('📊 Final violation result:', result);
   return result;
 };

 /**
  * 📊 Get zone statistics
  * @param {Object} zones - {grazing: [], nonGrazing: []}
  * @returns {Object} Zone statistics
  */
 export const getZoneStats = (zones) => {
   if (!zones) {
     return { totalZones: 0, grazingZones: 0, nonGrazingZones: 0 };
   }

   const grazingCount = zones.grazing ? zones.grazing.length : 0;
   const nonGrazingCount = zones.nonGrazing ? zones.nonGrazing.length : 0;

   return {
     totalZones: grazingCount + nonGrazingCount,
     grazingZones: grazingCount,
     nonGrazingZones: nonGrazingCount
   };
 };

 // =================== DEBUGGING HELPER FUNCTIONS ===================

 /**
  * 🔧 Debug zone data structure
  * @param {Object} zones - Zone data to debug
  */
 export const debugZones = (zones) => {
   console.log('=== ZONE DEBUG INFO ===');
   console.log('Zones object:', zones);

   if (zones && zones.grazing) {
     console.log('Grazing zones:', zones.grazing.length);
     zones.grazing.forEach((zone, i) => {
       console.log(`Grazing zone ${i}:`, zone);
     });
   }

   if (zones && zones.nonGrazing) {
     console.log('Non-grazing zones:', zones.nonGrazing.length);
     zones.nonGrazing.forEach((zone, i) => {
       console.log(`Non-grazing zone ${i}:`, zone);
     });
   }

   console.log('=== END DEBUG INFO ===');
 };

 /**
  * 🔧 Test point against zones
  * @param {Object} testPoint - Test location
  * @param {Object} zones - Zone data
  */
 export const testPointAgainstZones = (testPoint, zones) => {
   console.log('=== TESTING POINT AGAINST ZONES ===');
   console.log('Test point:', testPoint);

   debugZones(zones);

   const result = getZoneViolationDetails(testPoint, zones);
   console.log('Test result:', result);

   console.log('=== END TEST ===');
   return result;
 };