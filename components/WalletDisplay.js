// src/components/WalletDisplay.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Clipboard } from 'react-native';

const WalletDisplay = ({ wallet }) => {
  const shortWallet = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : '—';

  const copyToClipboard = () => {
    Clipboard.setString(wallet);
    alert('Wallet address copied!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>🔗 Wallet Address:</Text>
      <TouchableOpacity onPress={copyToClipboard}>
        <Text style={styles.address}>{shortWallet}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#1565c0',
  },
  address: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0d47a1',
    marginTop: 4,
  },
});

export default WalletDisplay;
