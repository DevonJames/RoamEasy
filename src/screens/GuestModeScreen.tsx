import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import Logo from '../assets/logo';

// Define theme colors
const COLORS = {
  primary: '#2E7D32',
  secondary: '#FF7043',
  text: '#333333',
  error: '#D32F2F',
  background: '#F5F5F5',
};

// Define navigation types
type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  GuestMode: undefined;
};

type MainStackParamList = {
  RoutePlanner: undefined;
  Home: undefined;
};

type GuestModeScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList & MainStackParamList>;

// Define type for feature card
interface FeatureCard {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  available: boolean;
}

const GuestModeScreen = () => {
  const navigation = useNavigation<GuestModeScreenNavigationProp>();
  const { continueAsGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinueAsGuest = async () => {
    setIsLoading(true);
    try {
      const result = await continueAsGuest();
      if (!result.success && result.error) {
        Alert.alert('Error', result.error.message);
      }
      // Navigation will happen via AppNavigator
    } catch (err) {
      Alert.alert('Error', 'Could not continue as guest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const featureCards: FeatureCard[] = [
    {
      icon: 'map-outline',
      title: 'Route Planning',
      description: 'Plan multi-stop routes with daily driving limits',
      available: true,
    },
    {
      icon: 'bed-outline',
      title: 'Resort Suggestions',
      description: 'Get curated resort recommendations',
      available: true,
    },
    {
      icon: 'save-outline',
      title: 'Save Trips',
      description: 'Save your trips for future reference',
      available: false,
    },
    {
      icon: 'calendar-outline',
      title: 'Calendar Export',
      description: 'Export your itinerary to Google Calendar',
      available: false,
    },
    {
      icon: 'cloud-offline-outline',
      title: 'Offline Access',
      description: 'Access your trips without internet',
      available: false,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Logo size={100} color={COLORS.primary} />
          <Text style={styles.appName}>RoamEasy</Text>
          <Text style={styles.tagline}>Explore as a Guest</Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            In guest mode, you can explore our route planning features and see resort suggestions.
            Create an account to save trips, export to calendar, and access offline.
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Available Features</Text>
          
          {featureCards.map((feature, index) => (
            <View key={index} style={[styles.featureCard, !feature.available && styles.disabledFeature]}>
              <View style={styles.featureIconContainer}>
                <Ionicons 
                  name={feature.icon} 
                  size={24} 
                  color={feature.available ? COLORS.primary : '#BDBDBD'} 
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, !feature.available && styles.disabledText]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, !feature.available && styles.disabledText]}>
                  {feature.description}
                </Text>
              </View>
              {!feature.available && (
                <View style={styles.lockContainer}>
                  <Ionicons name="lock-closed" size={18} color="#BDBDBD" />
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton, isLoading && styles.disabledButton]} 
            onPress={handleContinueAsGuest}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Loading...' : 'Continue as Guest'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.signInLink} 
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.signInText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: COLORS.text,
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#757575',
  },
  disabledFeature: {
    opacity: 0.8,
  },
  disabledText: {
    color: '#BDBDBD',
  },
  lockContainer: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  buttonContainer: {
    marginTop: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInLink: {
    alignItems: 'center',
    marginTop: 8,
  },
  signInText: {
    color: COLORS.text,
    fontSize: 14,
  },
});

export default GuestModeScreen; 