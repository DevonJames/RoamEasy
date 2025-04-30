import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ParamListBase, RouteProp } from '@react-navigation/native';
import { Alert } from 'react-native';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import RoutePlannerScreen from '../screens/RoutePlannerScreen';
import OfflineTripsScreen from '../screens/OfflineTripsScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Create bottom tab navigator
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  console.log('Rendering MainTabNavigator - Should show Home, Plan, Offline, Settings tabs');
  
  // Add effect to alert when component mounts
  useEffect(() => {
    console.log('🌴 MainTabNavigator MOUNTED - User should see tabs now');
    
    // Optional: Show alert to confirm component mounting
    setTimeout(() => {
      Alert.alert('Welcome to RoamEasy', 'You are now signed in and can start planning your trips!');
    }, 500);
    
    return () => {
      console.log('MainTabNavigator UNMOUNTED');
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: RouteProp<ParamListBase, string> }) => ({
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Plan') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Offline') {
            iconName = focused ? 'download' : 'download-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-circle';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E7D32', // Forest Green
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Home',
        }}
      />
      <Tab.Screen 
        name="Plan" 
        component={RoutePlannerScreen}
        options={{
          title: 'Plan Trip',
        }}
      />
      <Tab.Screen 
        name="Offline" 
        component={OfflineTripsScreen}
        options={{
          title: 'Offline Trips',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator; 