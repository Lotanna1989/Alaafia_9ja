// src/config/firebaseStorage.js
import { getStorage } from 'firebase/storage';
import app from './firebaseConfig'; // this imports your initialized Firebase app

const storage = getStorage(app);

export { storage };
