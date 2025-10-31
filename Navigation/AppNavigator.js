import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../contexts/AuthContext';
import RoleSelector from '../screens/auth/RoleSelector';
import HerderStack from './HerderStack';
import FarmerStack from './FarmerStack';
import AdminStack from './AdminStack';
import AIChatStack from "./AIChatStack"

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { role } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RoleSelector" component={RoleSelector} />
        <Stack.Screen name="Herder" component={HerderStack} />
        <Stack.Screen name="Farmer" component={FarmerStack} />
        <Stack.Screen name="AIChat" component={AIChatStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
