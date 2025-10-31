// src/utils/alertUtils.js
import { Audio } from 'expo-audio';
import { VideoView } from 'expo-video';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';


// 🔊 Sound file mapping
const sounds = {
  police: require('../assets/sounds/police_alarm.mp3'),
  warning: require('../assets/sounds/warning_tone.mp3'),
};

/**
 * 🔊 Play alert sound by type
 */
export const playAlertSound = async (type = 'warning') => {
  try {
    const { sound } = await Audio.Sound.createAsync(sounds[type]);
    await sound.playAsync();
  } catch (error) {
    console.warn('Could not play sound:', error);
  }
};

/**
 * 🗣 Speak alert message (Hausa/Pidgin)
 */
export const speakAlert = (message, language = 'pidgin') => {
  let text = message;
  let langCode = 'en';

  // Smart voice + message override
  if (language.toLowerCase() === 'hausa') {
    text = 'Ka bar wannan yanki yanzu!';
    langCode = 'ha-NG';
  } else if (language.toLowerCase() === 'pidgin') {
    text = 'Commot for this place sharp sharp!';
    langCode = 'en-NG';
  }

  Speech.speak(text, {
    language: langCode,
    rate: 0.9,
    pitch: 1.0,
  });
};

/**
 * 🧠 UI fallback in case audio fails
 */
export const showPopupAlert = (title, message) => {
  Alert.alert(title, message);
};
