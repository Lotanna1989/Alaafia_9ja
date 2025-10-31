import { collection, addDoc, getDocs, onSnapshot } from 'firebase/firestore';
 import { db } from '../config/firebaseConfig';

 /**
  * ✅ Save a zone to Firestore (Updated version)
  */
 export const saveZoneToFirebase = async (zoneType, coordinates) => {
   try {
     console.log('📡 Saving to Firebase:', { zoneType, coordinates });

     // Ensure coordinates is an array
     if (!Array.isArray(coordinates)) {
       throw new Error('Coordinates must be an array');
     }

     // Format coordinates to ensure consistent structure
     const formattedCoordinates = coordinates.map(coord => ({
       lat: coord.latitude ?? coord.lat,
       lng: coord.longitude ?? coord.lng
     }));

     // Validate coordinates
     const isValidCoordinates = formattedCoordinates.every(coord =>
       coord.lat !== undefined &&
       coord.lng !== undefined &&
       !isNaN(coord.lat) &&
       !isNaN(coord.lng)
     );

     if (!isValidCoordinates) {
       throw new Error('Invalid coordinates: lat/lng values are missing or invalid');
     }

     // Validate zone type
     if (!zoneType || !['grazing', 'non-grazing'].includes(zoneType)) {
       throw new Error('Invalid zone type. Must be "grazing" or "non-grazing"');
     }

     // Save to Firebase
     const docRef = await addDoc(collection(db, 'areas'), {
       type: zoneType,
       coordinates: formattedCoordinates,
       createdAt: new Date().toISOString()
     });

     console.log('✅ Zone saved to Firebase successfully with ID:', docRef.id);
     return docRef.id;

   } catch (error) {
     console.error('❌ Firebase save error:', error);
     throw error;
   }
 };

 /**
  * ✅ One-time fetch of zones (e.g. for offline cache)
  */
 export const loadZonesFromFirebase = async () => {
   try {
     const querySnapshot = await getDocs(collection(db, 'areas'));
     const zones = { grazing: [], nonGrazing: [] };

     querySnapshot.forEach((doc) => {
       const data = doc.data();
       const coordinates = data.coordinates.map(coord => ({
         lat: coord.lat ?? coord.latitude,
         lng: coord.lng ?? coord.longitude
       }));

       if (data.type === 'grazing') {
         zones.grazing.push(coordinates);
       } else if (data.type === 'non-grazing' || data.type === 'non-graz') {
         zones.nonGrazing.push(coordinates);
       }
     });

     return zones;
   } catch (error) {
     console.error('❌ Error loading zones from Firebase:', error);
     throw error;
   }
 };

 /**
  * ✅ Real-time sync of grazing and non-grazing zones
  */
 export const subscribeToZones = (callback) => {
   try {
     const unsubscribe = onSnapshot(collection(db, 'areas'), (snapshot) => {
       const zones = { grazing: [], nonGrazing: [] };

       snapshot.forEach((doc) => {
         const data = doc.data();
         const coordinates = data.coordinates.map(coord => ({
           lat: coord.lat ?? coord.latitude,
           lng: coord.lng ?? coord.longitude
         }));

         if (coordinates.length >= 3) {
           if (data.type === 'grazing') {
             zones.grazing.push(coordinates);
           } else if (data.type === 'non-grazing' || data.type === 'non-graz') {
             zones.nonGrazing.push(coordinates);
           }
         }
       });

       console.log('✅ Zones fetched from Firestore:', zones);
       callback(zones);
     }, (error) => {
       console.error('❌ Error subscribing to zones:', error);
       callback(null, error);
     });

     return unsubscribe;
   } catch (error) {
     console.error('❌ Error setting up zones subscription:', error);
     callback(null, error);
   }
 };

 /**
  * ✅ Used inside HerderDashboard to save zones
  */
 export const handleSaveZone = async (drawnPoints, drawingType) => {
   try {
     if (!drawnPoints || drawnPoints.length < 3) {
       throw new Error('Need at least 3 points to create a zone');
     }

     const firebaseType = drawingType === 'grazing' ? 'grazing' : 'non-grazing';
     const zoneId = await saveZoneToFirebase(firebaseType, drawnPoints);

     console.log('✅ Zone saved successfully with ID:', zoneId);
     return zoneId;

   } catch (error) {
     console.error('❌ Failed to save zone:', error);
     alert(`Failed to save zone: ${error.message}`);
   }
 };

 export const uploadCowLocation = async ({ userId, cowId, lat, lon }) => {
   try {
     await addDoc(collection(db, 'cowLocations'), {
       userId,
       cowId,
       lat,
       lon,
       timestamp: new Date().toISOString()
     });
   } catch (err) {
     console.error('❌ Failed to upload cow location:', err);
   }
 };

 export const subscribeToCowLocations = (callback) => {
   return onSnapshot(collection(db, 'cowLocations'), (snapshot) => {
     const locations = {};
     snapshot.forEach((doc) => {
       const data = doc.data();
       locations[data.userId] = {
         lat: data.lat,
         lon: data.lon,
         timestamp: data.timestamp
       };
     });
     callback(locations);
   });
 };
