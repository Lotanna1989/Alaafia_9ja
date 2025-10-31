import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HerderDashboard from '../screens/herder/HerderDashboard';
// import more herder-specific screens here

const Stack = createNativeStackNavigator();

export default function HerderStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HerderDashboard" component={HerderDashboard} />
      {/* Add more Herder screens here */}
    </Stack.Navigator>
  );
}
