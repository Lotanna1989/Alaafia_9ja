// src/utils/languageUtils.js

const translations = {
  english: {
    'Leave this area now!': 'Leave this area now!',
    'You are in a restricted zone': 'You are in a restricted zone',
    'Move to safe area immediately': 'Move to safe area immediately',
    'Restricted Area Alert': 'Restricted Area Alert',
    'Safe grazing area': 'Safe grazing area',
    'Undesignated area': 'Undesignated area'
  },
  hausa: {
    'Leave this area now!': 'Ka bar wannan yanki yanzu!',
    'You are in a restricted zone': 'Kana cikin yanki da aka hana',
    'Move to safe area immediately': 'Matsa zuwa wurin da yake lafiya nan take',
    'Restricted Area Alert': 'Sanarwar Yanki da aka Hana',
    'Safe grazing area': 'Wurin kiwo mai lafiya',
    'Undesignated area': 'Yanki da ba a tantance ba'
  },
  pidgin: {
    'Leave this area now!': 'Commot for this place sharp sharp!',
    'You are in a restricted zone': 'You dey inside area wey dem ban',
    'Move to safe area immediately': 'Move go safe place now now',
    'Restricted Area Alert': 'Warning for Bad Area',
    'Safe grazing area': 'Safe place for cow',
    'Undesignated area': 'Area wey no get label'
  }
};

/**
 * 🌐 Translate message to specified language
 * @param {string} message - Message to translate
 * @param {string} language - Target language (english, hausa, pidgin)
 * @returns {string} Translated message
 */
export const translateMessage = (message, language = 'english') => {
  const lang = language.toLowerCase();

  if (translations[lang] && translations[lang][message]) {
    return translations[lang][message];
  }

  // Fallback to English if translation not found
  return message;
};

/**
 * 🗣 Get appropriate voice language code for speech
 * @param {string} language - Language preference
 * @returns {string} Speech language code
 */
export const getVoiceLanguageCode = (language = 'english') => {
  const languageCodes = {
    english: 'en-US',
    hausa: 'ha-NG',
    pidgin: 'en-NG'
  };

  return languageCodes[language.toLowerCase()] || 'en-US';
};

/**
 * 📱 Get all available languages
 * @returns {Array} List of supported languages
 */
export const getAvailableLanguages = () => {
  return Object.keys(translations);
};

/**
 * 🎯 Get common alert messages in specified language
 * @param {string} language - Target language
 * @returns {Object} Common alert messages
 */
export const getAlertMessages = (language = 'english') => {
  const lang = language.toLowerCase();

  return {
    restrictedAreaAlert: translateMessage('Restricted Area Alert', lang),
    leaveAreaNow: translateMessage('Leave this area now!', lang),
    restrictedZone: translateMessage('You are in a restricted zone', lang),
    moveToSafeArea: translateMessage('Move to safe area immediately', lang),
    safeGrazingArea: translateMessage('Safe grazing area', lang),
    undesignatedArea: translateMessage('Undesignated area', lang)
  };
};


