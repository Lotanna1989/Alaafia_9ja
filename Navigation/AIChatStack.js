import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatBotScreen from '../screens/AIChat/ChatBotScreen'; // ✅ Correct import

const Stack = createNativeStackNavigator();

export default function AIChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatBotS" component={ChatBotScreen} />
      {/* Add more AI chat-related screens here if needed */}
    </Stack.Navigator>
  );
}
