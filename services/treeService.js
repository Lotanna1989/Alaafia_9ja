// src/services/treeService.js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebaseStorage'; // make sure you exported this
import * as ImagePicker from 'expo-file-system';

export const handleTreePlanting = async (userId) => {
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (result.canceled) return;

    const image = result.assets[0];
    const blob = await fetch(image.uri).then(res => res.blob());

    const filename = `trees/${userId}_${Date.now()}.jpg`;
    const imageRef = ref(storage, filename);
    await uploadBytes(imageRef, blob);

    const imageUrl = await getDownloadURL(imageRef);
    await addDoc(collection(db, 'plantedTrees'), {
      userId,
      imageUrl,
      timestamp: serverTimestamp(),
    });

    Alert.alert('🌳 Tree planted!', '+10 carbon credit tokens awarded!');
  } catch (e) {
    console.error('Tree planting error:', e);
    Alert.alert('Error', e.message);
  }
};