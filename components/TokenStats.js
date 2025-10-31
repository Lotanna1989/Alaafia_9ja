// src/components/TokenStats.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const TokenStats = ({ userId }) => {
  const [tokens, setTokens] = useState(0);

  useEffect(() => {
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTokens(data.tokens || 0);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>🌍 Carbon Credit Tokens:</Text>
      <Text style={styles.value}>{tokens}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#388e3c',
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
});

export default TokenStats;
