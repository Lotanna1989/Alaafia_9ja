// App.js
import React from 'react';
import AppNavigator from './Navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
