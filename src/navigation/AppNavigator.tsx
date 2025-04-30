import React, { useEffect, useState, useRef, useCallback } from 'react';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { View, Text, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';

// EMERGENCY FIX: Clear navigation state on startup if black screen occurs
// This should be removed after the issue is resolved
if (__DEV__) {
  try {
    // Try to clear any navigation state that might be causing black screens
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.removeItem('navigation-state').catch((err) => console.error('Failed to clear nav state:', err));
    console.log('DEV MODE: Cleared navigation state cache for debugging');
  } catch (error) {
    console.error('Error clearing navigation state:', error);
  }
}

// Import navigation helper
import { navigationRef, RootNavigatorParamList, resetToMain as navResetToMain, resetToAuth as navResetToAuth, logAvailableRoutes } from './navigationHelper';

// Import actual screen components
import HomeScreen from '../screens/HomeScreen';
import RoutePlannerScreen from '../screens/RoutePlannerScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import OfflineTripsScreen from '../screens/OfflineTripsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import GuestModeScreen from '../screens/GuestModeScreen';
import ResortDetailsScreen from '../screens/ResortDetailsScreen';
import SplashScreen from '../screens/SplashScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import MainTabNavigator from './MainTabNavigator';

// Import auth hook
import useAuth from '../hooks/useAuth';

// Define theme colors
const COLORS = {
  primary: '#2E7D32',
  secondary: '#FF7043',
};

// Define the stack navigator types
type AuthStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  SignUp: undefined;
  GuestMode: undefined;
  ForgotPassword: undefined;
};

type MainStackParamList = {
  Main: undefined;
  Itinerary: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
};

type MainTabParamList = {
  Home: undefined;
  RoutePlanner: undefined;
  OfflineTrips: undefined;
  Settings: undefined;
};

// Create the navigators
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Auth Stack Navigator
const AuthNavigator = () => {
  console.log('Rendering AuthNavigator');
  
  // Make sure to render a simple default screen if there's any issue
  try {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="SignIn" component={SignInScreen} />
        <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <AuthStack.Screen name="GuestMode" component={GuestModeScreen} />
        <AuthStack.Screen name="Splash" component={SplashScreen} />
      </AuthStack.Navigator>
    );
  } catch (error) {
    console.error('Error rendering AuthNavigator:', error);
    // Fallback UI in case of error
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E1' }}>
        <Text style={{ fontSize: 18, color: '#2E7D32', marginBottom: 20 }}>RoamEasy</Text>
        <Text>There was a problem loading the authentication screens.</Text>
        <TouchableOpacity 
          style={{ 
            marginTop: 20,
            backgroundColor: '#2E7D32',
            padding: 10,
            borderRadius: 5
          }}
          onPress={() => {
            // Force reload the app
            if (Platform) {
              const { Platform } = require('react-native');
              if (Platform.OS === 'web') {
                window.location.reload();
              }
            }
          }}
        >
          <Text style={{ color: 'white' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
};

// Root Navigator
const AppNavigator = () => {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  
  // Simplified state: isLoading is the only initial concern
  if (isLoading) {
    return (
      <NavigationContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading...</Text>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </NavigationContainer>
    );
  }
  
  console.log('AppNavigator Render - Auth State:', { isAuthenticated, isGuest, isLoading });

  return (
    <NavigationContainer 
      ref={navigationRef}
      onStateChange={(state) => {
        // Log navigation state changes for debugging
        console.log('Navigation state updated:', state?.routes[state.index]?.name);
      }}
    >
      {isAuthenticated || isGuest ? (
        // User is Authenticated or Guest -> Show Main App
        <MainStack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
          <MainStack.Screen name="Main" component={MainTabNavigator} />
          <MainStack.Screen 
            name="Itinerary" 
            component={ItineraryScreen}
            options={{
              headerShown: true,
              title: 'Trip Itinerary',
              headerTintColor: 'white',
              headerStyle: { backgroundColor: COLORS.primary },
            }}
          />
          <MainStack.Screen 
            name="ResortDetails" 
            component={ResortDetailsScreen}
            options={{
              headerShown: true,
              title: 'Resort Options',
              headerTintColor: 'white',
              headerStyle: { backgroundColor: COLORS.primary },
            }}
          />
        </MainStack.Navigator>
      ) : (
        // User is Not Authenticated and Not Guest -> Show Auth Flow
        <AuthStack.Navigator initialRouteName="SignIn" screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <AuthStack.Screen name="GuestMode" component={GuestModeScreen} />
          <AuthStack.Screen name="Splash" component={SplashScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator; 