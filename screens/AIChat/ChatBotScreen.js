import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import axios from 'axios';

const ChatBotScreen = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('hausa'); // or 'yoruba', 'igbo', 'pidgin'

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    try {
      const response = await axios.post('https://your-server.com/api/chat', {
        message: inputText,
        language,
      });

      const botText = response.data.reply;
      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
      Speech.speak(botText, { language: getSpeechLang(language) });
    } catch (err) {
      console.error(err);
    }
  };

  const getSpeechLang = (lang) => {
    switch (lang) {
      case 'hausa': return 'ha';
      case 'yoruba': return 'yo';
      case 'igbo': return 'ig';
      case 'pidgin': return 'en-GB'; // use English for now
      default: return 'en';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤖 AgroRithm AI Bot</Text>

      <View style={styles.languageRow}>
        {['hausa', 'yoruba', 'igbo', 'pidgin'].map(l => (
          <TouchableOpacity
            key={l}
            onPress={() => setLanguage(l)}
            style={[styles.langButton, language === l && styles.activeLang]}
          >
            <Text style={styles.langText}>{l.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.chatBox}>
        {messages.map((msg, idx) => (
          <Text key={idx} style={msg.role === 'user' ? styles.userMsg : styles.botMsg}>
            {msg.role === 'user' ? '👤' : '🤖'} {msg.text}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask a question..."
          style={styles.input}
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatBotScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f4f4f4' },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  chatBox: { flex: 1, marginVertical: 10 },
  userMsg: { backgroundColor: '#d4edda', margin: 5, padding: 10, borderRadius: 5 },
  botMsg: { backgroundColor: '#f8d7da', margin: 5, padding: 10, borderRadius: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10 },
  sendBtn: { marginLeft: 10, backgroundColor: 'green', padding: 10, borderRadius: 5 },
  sendText: { color: 'white' },
  languageRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  langButton: { padding: 8, borderRadius: 5, backgroundColor: '#ccc' },
  activeLang: { backgroundColor: 'green' },
  langText: { color: 'white' }
});
