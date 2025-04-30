import React from 'react';
import { CommonActions, NavigationContainerRef } from '@react-navigation/native';

// Define route types for the ROOT navigator
export type RootNavigatorParamList = {
  Main: undefined;
  Itinerary: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
  AuthStack: undefined; 
  SignIn: undefined;
};

// Define route types for the MainStack navigator
export type MainStackParamList = {
  Main: undefined;
  Itinerary: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
};

// Create a ref that can be accessed outside of the component
// Important: This ref is for the ROOT navigator
export const navigationRef = React.createRef<NavigationContainerRef<RootNavigatorParamList>>();

// Debug function to show all available routes
export function logAvailableRoutes() {
  if (navigationRef.current) {
    const state = navigationRef.current.getRootState();
    console.log('Available routes in root navigator:', state.routeNames);
    
    // Try to get more details about routes and navigators
    try {
      // @ts-ignore - This is internal but helpful for debugging
      const routes = navigationRef.current.getRootState().routes;
      routes.forEach((route: any) => {
        console.log(`Route ${route.name}:`, route);
        if (route.state && route.state.routes) {
          console.log(`Nested routes in ${route.name}:`, route.state.routes.map((r: any) => r.name));
        }
      });
    } catch (error) {
      console.error('Error getting detailed route info:', error);
    }
  } else {
    console.error('Navigation ref not available for logging routes');
  }
}

// Navigate to a screen within a stack
export function navigate(name: keyof RootNavigatorParamList, params?: any) {
  if (navigationRef.current) {
    console.log(`Navigating to ${name} from navigationHelper`);
    navigationRef.current.navigate(name, params);
  } else {
    console.error('Navigation ref not available for navigate');
  }
}

// Reset to the auth stack
export function resetToAuth() {
  console.log('Resetting navigation to SignIn screen');
  
  // First try to clear the auth state in AsyncStorage to force a true logout
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    // Fire and forget - don't wait for these to complete
    AsyncStorage.removeItem('guest_mode');
    AsyncStorage.removeItem('user_authenticated');
    AsyncStorage.removeItem('force_auth_state');
    AsyncStorage.removeItem('user_profile');
    AsyncStorage.removeItem('auth_timestamp');
    
    console.log('Cleared auth state in AsyncStorage');
  } catch (error) {
    console.error('Failed to clear auth storage:', error);
  }
  
  // Then reset the navigation
  if (navigationRef.current) {
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'SignIn' }]
      })
    );
  } else {
    console.error('Navigation ref is not available! Cannot reset to auth stack.');
  }
}

// Reset to the main stack
export function resetToMain() {
  console.log('Resetting navigation to Main screen');
  
  try {
    // Extra help - set AsyncStorage flag for AppNavigator to check
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem('force_auth_state', 'authenticated');
    AsyncStorage.setItem('auth_timestamp', Date.now().toString());
  } catch (error) {
    console.error('Failed to set force_auth_state:', error);
  }
  
  if (navigationRef.current) {
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }]
      })
    );
  } else {
    console.error('Navigation ref is not available! Cannot reset to main stack.');
  }
} 