import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FarmerDashboard from '../screens/farmer/FarmerDashboard';

const Stack = createNativeStackNavigator();

export default function FarmerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FarmerDashboard" component={FarmerDashboard} />
      {/* Add more Farmer screens here */}
    </Stack.Navigator>
  );
}
