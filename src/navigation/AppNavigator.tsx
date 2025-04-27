import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';

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
  AuthStack: undefined;
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
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="GuestMode" component={GuestModeScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
};

// Main Tab Navigator
const MainTabNavigator = () => {
  return (
    <MainTab.Navigator
      screenOptions={({ route }: { route: RouteProp<MainTabParamList, keyof MainTabParamList> }) => ({
        tabBarIcon: ({ focused, color, size }: { focused: boolean, color: string, size: number }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'RoutePlanner') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'OfflineTrips') {
            iconName = focused ? 'cloud-offline' : 'cloud-offline-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <MainTab.Screen name="Home" component={HomeScreen} />
      <MainTab.Screen name="RoutePlanner" component={RoutePlannerScreen} />
      <MainTab.Screen name="OfflineTrips" component={OfflineTripsScreen} />
      <MainTab.Screen name="Settings" component={SettingsScreen} />
    </MainTab.Navigator>
  );
};

// Root Navigator
const AppNavigator = () => {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const [initialRoute, setInitialRoute] = useState<'Main' | 'AuthStack'>('AuthStack');

  useEffect(() => {
    if (isAuthenticated || isGuest) {
      setInitialRoute('Main');
    } else {
      setInitialRoute('AuthStack');
    }
  }, [isAuthenticated, isGuest]);

  if (isLoading) {
    // Return a loading screen
    return null;
  }

  return (
    <NavigationContainer>
      <MainStack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        {(isAuthenticated || isGuest) ? (
          <>
            <MainStack.Screen name="Main" component={MainTabNavigator} />
            <MainStack.Screen 
              name="Itinerary" 
              component={ItineraryScreen}
              options={{
                headerShown: true,
                title: 'Trip Itinerary',
                headerTintColor: 'white',
                headerStyle: {
                  backgroundColor: COLORS.primary,
                },
              }}
            />
            <MainStack.Screen 
              name="ResortDetails" 
              component={ResortDetailsScreen}
              options={{
                headerShown: true,
                title: 'Resort Options',
                headerTintColor: 'white',
                headerStyle: {
                  backgroundColor: COLORS.primary,
                },
              }}
            />
          </>
        ) : (
          <MainStack.Screen name="AuthStack" component={AuthNavigator} />
        )}
      </MainStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 