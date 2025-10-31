import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function RoleSelector() {
  const { setRole } = useAuth();
  const navigation = useNavigation();

  const handleSelect = (role) => {
    setRole(role);
    navigation.navigate(role.charAt(0).toUpperCase() + role.slice(1));

  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Role</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleSelect('farmer')}>
        <Text>Farmer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleSelect('herder')}>
        <Text>Herder</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleSelect('admin')}>
        <Text>Admin</Text>
      </TouchableOpacity>

       <TouchableOpacity style={styles.button} onPress={() => handleSelect('AIChat')}>
              <Text>AI Chatbot Farmer/Herder</Text>
            </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 26, marginBottom: 20 },
  button: {
    backgroundColor: '#e0ffe0',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center'
  },
});
