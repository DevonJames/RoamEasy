import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { validateEnvironment } from './src/utils/environment';

export default function App() {
  useEffect(() => {
    const checkEnvironment = async () => {
      const { isValid, missing } = validateEnvironment();
      
      if (!isValid) {
        console.error(`Missing environment variables: ${missing.join(', ')}`);
      }
    };
    
    checkEnvironment();
  }, []);
  
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}