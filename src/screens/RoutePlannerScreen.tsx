import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import useMaps from '../hooks/useMaps';
import { usePreferences } from '../hooks/usePreferences';
import useTrips, { TripStop } from '../hooks/useTrips';
import { debounce } from 'lodash';
import SupabaseService from '../services/SupabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/environment';

// Define navigation types
type RootStackParamList = {
  HomeScreen: undefined;
  RoutePlanner: undefined;
  ItineraryScreen: { tripId: string };
  ResortDetailsScreen: { tripId: string, stopId: string };
  Settings: undefined;
  OfflineTrips: undefined;
};

type RoutePlannerScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoutePlanner'>;

// Define theme colors
const COLORS = {
  primary: '#2E7D32',
  secondary: '#FF7043',
  text: '#333333',
  error: '#D32F2F',
  background: '#F5F5F5',
  border: '#E0E0E0',
  placeholder: '#9E9E9E',
};

// Define scenery preference options
const sceneryOptions = [
  { id: 'coast', label: 'Coastal Views', icon: 'water-outline' as const },
  { id: 'mountains', label: 'Mountain Passes', icon: 'triangle-outline' as const },
  { id: 'forest', label: 'Forested Areas', icon: 'leaf-outline' as const },
  { id: 'rivers', label: 'Rivers & Lakes', icon: 'boat-outline' as const },
  { id: 'desert', label: 'Desert Landscapes', icon: 'sunny-outline' as const },
];

// Define route stop interface
interface RouteStop {
  date: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

// Define route result interface
interface RouteResult {
  startCoords: {
    latitude: number;
    longitude: number;
  };
  endCoords: {
    latitude: number;
    longitude: number;
  };
  recommendedStops: RouteStop[];
}

// Define location search result interface
interface LocationResult {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

// Define UserPreferences interface
interface UserPreferences {
  scenery_preferences?: string[];
  driving_preferences?: {
    max_drive_hours?: number;
  };
}

const RoutePlannerScreen = () => {
  const navigation = useNavigation<RoutePlannerScreenNavigationProp>();
  const { preferences, isLoading: prefsLoading } = usePreferences<UserPreferences>();
  const { planRoute, searchLocation, isLoading: mapsLoading } = useMaps();
  const { createTrip, isLoading: tripLoading } = useTrips();

  // Form state
  const [tripName, setTripName] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startLocationResults, setStartLocationResults] = useState<LocationResult[]>([]);
  const [endLocationResults, setEndLocationResults] = useState<LocationResult[]>([]);
  const [maxDriveHours, setMaxDriveHours] = useState(5);
  const [selectedScenery, setSelectedScenery] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isStartFocused, setIsStartFocused] = useState(false);
  const [isEndFocused, setIsEndFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isLoadingCombined = prefsLoading || mapsLoading || tripLoading || isLoading;

  // Load preferences on mount
  useEffect(() => {
    if (preferences) {
      // Check if scenery_preferences exists and is an array
      if (preferences.scenery_preferences && Array.isArray(preferences.scenery_preferences)) {
        setSelectedScenery(preferences.scenery_preferences);
      }
      // Check if driving_preferences exists and has max_drive_hours property
      if (preferences.driving_preferences && 
          typeof preferences.driving_preferences.max_drive_hours === 'number') {
        setMaxDriveHours(preferences.driving_preferences.max_drive_hours);
      }
    }
  }, [preferences]);

  // Test Supabase connection on mount
  useEffect(() => {
    async function testSupabaseConnection() {
      console.log('Testing Supabase connection...');
      console.log('URL:', SUPABASE_URL);
      console.log('Key:', SUPABASE_ANON_KEY ? 'Exists (not shown for security)' : 'Missing');
      
      try {
        // First check the database schema
        const dbCheck = await SupabaseService.checkDatabase();
        if (!dbCheck.success) {
          console.error('Database check failed:', dbCheck.error);
          console.log('Available tables:', dbCheck.tables);
          
          if (dbCheck.tables && dbCheck.tables.length > 0) {
            Alert.alert(
              'Database Error',
              `The app cannot connect to the required tables. Please check the Supabase project setup.\n\nError: ${dbCheck.error}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Database Connection Error',
              'Cannot connect to Supabase. Please check your internet connection and API keys.',
              [{ text: 'OK' }]
            );
          }
          return;
        }
        
        console.log('Database check passed, tables:', dbCheck.tables);
        
        // Test retrieving trips as well
        const testUserId = '00000000-0000-0000-0000-000000000000';
        const { trips, error } = await SupabaseService.getTrips(testUserId);
          
        if (error) {
          console.error('Error accessing trips table:', error);
        } else {
          console.log('Successfully connected to trips table, found trips:', trips.length);
        }
      } catch (err) {
        console.error('Failed to test Supabase connection:', err);
        Alert.alert(
          'Connection Error',
          'An unexpected error occurred while connecting to the database.',
          [{ text: 'OK' }]
        );
      }
    }
    
    testSupabaseConnection();
  }, []);

  // Search locations with debounce
  const debouncedSearchStart = useCallback(
    debounce(async (text: string) => {
      if (text.length > 2) {
        try {
          const result = await searchLocation(text);
          if (result.success && result.locations) {
            const formattedResults = result.locations.map((loc: any) => ({
              description: loc.description,
              placeId: loc.placeId || '',
              mainText: loc.mainText || loc.description.split(',')[0],
              secondaryText: loc.secondaryText || loc.description.split(',').slice(1).join(','),
            }));
            setStartLocationResults(formattedResults);
          }
        } catch (err) {
          console.error('Error searching location:', err);
          setStartLocationResults([]);
        }
      } else {
        setStartLocationResults([]);
      }
    }, 500),
    []
  );

  const debouncedSearchEnd = useCallback(
    debounce(async (text: string) => {
      if (text.length > 2) {
        try {
          const result = await searchLocation(text);
          if (result.success && result.locations) {
            const formattedResults = result.locations.map((loc: any) => ({
              description: loc.description,
              placeId: loc.placeId || '',
              mainText: loc.mainText || loc.description.split(',')[0],
              secondaryText: loc.secondaryText || loc.description.split(',').slice(1).join(','),
            }));
            setEndLocationResults(formattedResults);
          }
        } catch (err) {
          console.error('Error searching location:', err);
          setEndLocationResults([]);
        }
      } else {
        setEndLocationResults([]);
      }
    }, 500),
    []
  );

  // Handle location input changes
  const handleStartLocationChange = (text: string) => {
    setStartLocation(text);
    debouncedSearchStart(text);
  };

  const handleEndLocationChange = (text: string) => {
    setEndLocation(text);
    debouncedSearchEnd(text);
  };

  // Handle selection of location from autocomplete results
  const handleSelectStartLocation = (item: LocationResult) => {
    setStartLocation(item.description);
    setStartLocationResults([]);
    setIsStartFocused(false);
  };

  const handleSelectEndLocation = (item: LocationResult) => {
    setEndLocation(item.description);
    setEndLocationResults([]);
    setIsEndFocused(false);
  };

  // Handle scenery selection
  const toggleSceneryOption = (sceneryId: string) => {
    if (selectedScenery.includes(sceneryId)) {
      setSelectedScenery(selectedScenery.filter(id => id !== sceneryId));
    } else {
      setSelectedScenery([...selectedScenery, sceneryId]);
    }
  };

  // Navigation between steps
  const handleNextStep = () => {
    if (step === 1) {
      if (!tripName.trim()) {
        setError('Please provide a name for your trip');
        return;
      }
      if (!startLocation.trim()) {
        setError('Please provide a starting location');
        return;
      }
      if (!endLocation.trim()) {
        setError('Please provide an end destination');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (selectedScenery.length === 0) {
        setError('Please select at least one scenery preference');
        return;
      }
      setError(null);
      handlePlanRoute();
    }
  };

  const handlePreviousStep = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  // Calculate route using Maps service
  const calculateRoute = async () => {
    try {
      setError(null);
      // Convert string array to object format expected by planRoute
      const sceneryPreferences = {
        coast: selectedScenery.includes('coast'),
        mountains: selectedScenery.includes('mountains'),
        forest: selectedScenery.includes('forest'),
        rivers: selectedScenery.includes('rivers'),
        desert: selectedScenery.includes('desert')
      };
      
      // First, geocode the city names to get coordinates
      console.log("Geocoding starting location:", startLocation);
      const startLocationResult = await searchLocation(startLocation);
      if (!startLocationResult.success || !startLocationResult.locations || startLocationResult.locations.length === 0) {
        throw new Error(`Could not geocode starting location: ${startLocation}`);
      }
      
      console.log("Geocoding end location:", endLocation);
      const endLocationResult = await searchLocation(endLocation);
      if (!endLocationResult.success || !endLocationResult.locations || endLocationResult.locations.length === 0) {
        throw new Error(`Could not geocode end location: ${endLocation}`);
      }
      
      // Get the first result for each location
      const startLocationData = startLocationResult.locations[0];
      const endLocationData = endLocationResult.locations[0];
      
      // Display geocoding results for debugging
      console.log("Geocoded start location:", startLocationData);
      console.log("Geocoded end location:", endLocationData);
      
      // Now we can create properly structured location objects with actual coordinates
      const startLocationObj = {
        coordinates: startLocationData.coordinates,
        address: startLocation
      };
      
      const endLocationObj = {
        coordinates: endLocationData.coordinates,
        address: endLocation
      };
      
      // Log the location objects we're sending to planRoute
      console.log("Using start location object:", startLocationObj);
      console.log("Using end location object:", endLocationObj);
      
      const result = await planRoute({
        startLocation: startLocationObj,
        endLocation: endLocationObj,
        maxDriveTimeHours: maxDriveHours,
        sceneryPreferences
      });

      if (!result.success || !result.route || !result.stops) {
        throw new Error(result.error?.message || 'Failed to calculate route');
      }
      
      // Debug information for route planning
      console.log('Route planning result:', JSON.stringify(result, null, 2));
      console.log('Stops received from route planning:', result.stops?.length || 0);
      
      // Important fix: If we get stops directly from route planning or from result.stops, use those
      const planningStops = result.stops || [];
      console.log('Planning stops before processing:', JSON.stringify(planningStops, null, 2));
      
      if (planningStops && planningStops.length > 0) {
        // Calculate dates for each stop
        const todayDate = new Date();
        const recommendedStops = planningStops.map((stop, index) => ({
          date: new Date(todayDate.getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          location: {
            latitude: stop.coordinates.latitude,
            longitude: stop.coordinates.longitude,
            address: stop.address || `Location near ${stop.coordinates.latitude}, ${stop.coordinates.longitude}`
          }
        }));
        
        console.log('Created recommendedStops from planning stops:', JSON.stringify(recommendedStops, null, 2));
        
        const mockRouteResult: RouteResult = {
          startCoords: {
            latitude: startLocationObj.coordinates.latitude,
            longitude: startLocationObj.coordinates.longitude
          },
          endCoords: {
            latitude: endLocationObj.coordinates.latitude,
            longitude: endLocationObj.coordinates.longitude
          },
          recommendedStops: recommendedStops
        };
        
        return mockRouteResult;
      }
      
      // For now, construct a mock RouteResult that matches the interface our app expects
      const mockRouteResult: RouteResult = {
        startCoords: {
          latitude: startLocationObj.coordinates.latitude,
          longitude: startLocationObj.coordinates.longitude
        },
        endCoords: {
          latitude: endLocationObj.coordinates.latitude,
          longitude: endLocationObj.coordinates.longitude
        },
        recommendedStops: []
      };
      
      // IMPORTANT: If we have no stops at this point, manually create some
      if (mockRouteResult.recommendedStops.length === 0) {
        console.log('No stops available - manually creating at least two stops');
        
        // Start point as first stop
        const startStop = {
          date: new Date().toISOString().split('T')[0],
          location: {
            latitude: startLocationObj.coordinates.latitude,
            longitude: startLocationObj.coordinates.longitude,
            address: startLocation
          }
        };
        
        // End point as final stop
        const endStop = {
          date: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          location: {
            latitude: endLocationObj.coordinates.latitude,
            longitude: endLocationObj.coordinates.longitude,
            address: endLocation
          }
        };
        
        // For long routes, add a midpoint
        if (result.route && result.route.totalDistance > 500000) { // > 500 km
          // Calculate a rough midpoint 
          const midLat = (startLocationObj.coordinates.latitude + endLocationObj.coordinates.latitude) / 2;
          const midLng = (startLocationObj.coordinates.longitude + endLocationObj.coordinates.longitude) / 2;
          
          const midpointStop = {
            date: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            location: {
              latitude: midLat,
              longitude: midLng,
              address: `Midpoint between ${startLocation} and ${endLocation}`
            }
          };
          
          // Add the midpoint and adjust the end date
          mockRouteResult.recommendedStops = [startStop, midpointStop, endStop];
          console.log('Created three stops including midpoint');
        } else {
          // Just use start and end for shorter routes
          mockRouteResult.recommendedStops = [startStop, endStop];
          console.log('Created two stops (start and end only)');
        }
      }
      
      console.log('Final mockRouteResult:', JSON.stringify(mockRouteResult, null, 2));
      return mockRouteResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      throw new Error(errorMessage);
    }
  };

  // Create trip with calculated route
  const handlePlanRoute = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const routeResult = await calculateRoute();

      if (!routeResult) {
        throw new Error('Failed to calculate route');
      }

      console.log('Route result with stops:', routeResult.recommendedStops.length);
      console.log('Creating stop data from recommended stops:', JSON.stringify(routeResult.recommendedStops, null, 2));

      // Map recommended stops to the format expected by createTrip
      const stops = routeResult.recommendedStops.map((stop, index) => ({
        location: {
          latitude: stop.location.latitude,
          longitude: stop.location.longitude,
          address: stop.location.address
        },
        stop_order: index,
        check_in: stop.date,
        check_out: index < routeResult.recommendedStops.length - 1 
          ? routeResult.recommendedStops[index + 1].date 
          : new Date(new Date(stop.date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next day as default
        notes: `Location: ${stop.location.address}`,
        resort_id: '00000000-0000-4000-8000-000000000000' // Default resort ID required by schema
      }));

      console.log('Final stops being sent with createTrip:', JSON.stringify(stops, null, 2));

      // Debug log all trip data
      console.log('COMPLETE TRIP DATA BEFORE CREATION:', JSON.stringify({
        name: tripName,
        start_location: {
          address: startLocation,
          latitude: routeResult.startCoords.latitude,
          longitude: routeResult.startCoords.longitude
        },
        end_location: {
          address: endLocation,
          latitude: routeResult.endCoords.latitude,
          longitude: routeResult.endCoords.longitude
        },
        status: 'planned',
        stops: stops
      }, null, 2));

      // Verify stops array is valid and non-empty
      if (!stops || stops.length === 0) {
        console.warn('WARNING: No stops detected before trip creation!');
        console.log('Route result had recommendedStops:', routeResult.recommendedStops.length);
      }

      // Create the trip with the calculated route
      const newTrip = await createTrip({
        name: tripName,
        start_location: {
          address: startLocation,
          latitude: routeResult.startCoords.latitude,
          longitude: routeResult.startCoords.longitude
        },
        end_location: {
          address: endLocation,
          latitude: routeResult.endCoords.latitude,
          longitude: routeResult.endCoords.longitude
        },
        status: 'planned',
        stops: stops
      });

      setIsLoading(false);
      if (newTrip.success && newTrip.trip) {
        navigation.navigate('Itinerary', { tripId: newTrip.trip.id });
      } else {
        throw new Error(newTrip.error?.message || 'Failed to create trip');
      }
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      Alert.alert('Route Planning Error', errorMessage);
    }
  };

  // Location search result item renderer
  const renderLocationItem = (item: LocationResult, onSelect: (item: LocationResult) => void) => (
    <TouchableOpacity 
      style={styles.locationItem} 
      onPress={() => onSelect(item)}
      accessible={true}
      accessibilityLabel={item.description}
      accessibilityHint="Tap to select this location"
    >
      <Ionicons name="location-outline" size={20} color={COLORS.primary} style={styles.locationIcon} />
      <View style={styles.locationTextContainer}>
        <Text style={styles.locationMainText}>{item.mainText}</Text>
        <Text style={styles.locationSecondaryText}>{item.secondaryText}</Text>
      </View>
    </TouchableOpacity>
  );

  // Render scenery option
  const renderSceneryOption = (item: { id: string, label: string, icon: keyof typeof Ionicons.glyphMap }) => {
    const isSelected = selectedScenery.includes(item.id);
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.sceneryOption, isSelected && styles.sceneryOptionSelected]}
        onPress={() => toggleSceneryOption(item.id)}
        accessible={true}
        accessibilityLabel={`${item.label} ${isSelected ? 'selected' : 'not selected'}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
      >
        <Ionicons 
          name={item.icon} 
          size={24} 
          color={isSelected ? 'white' : COLORS.primary} 
          style={styles.sceneryIcon} 
        />
        <Text style={[styles.sceneryLabel, isSelected && styles.sceneryLabelSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 1 ? 'Plan Your Route' : 'Scenery Preferences'}
            </Text>
            {step > 1 && (
              <TouchableOpacity 
                onPress={handlePreviousStep}
                style={styles.backButton}
                accessible={true}
                accessibilityLabel="Go back to previous step"
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isLoadingCombined ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Planning your perfect route...</Text>
            </View>
          ) : (
            <>
              {step === 1 && (
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Trip Name</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="bookmark-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Summer Mountains Adventure"
                        value={tripName}
                        onChangeText={setTripName}
                        accessibilityLabel="Trip name input"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Starting Point</Text>
                    <View style={styles.locationInputContainer}>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="locate-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="e.g., Denver, CO"
                          value={startLocation}
                          onChangeText={handleStartLocationChange}
                          onFocus={() => setIsStartFocused(true)}
                          accessibilityLabel="Starting location input"
                        />
                      </View>
                      {isStartFocused && startLocationResults.length > 0 && (
                        <FlatList
                          data={startLocationResults}
                          keyExtractor={(item) => item.placeId || item.description}
                          renderItem={({ item }) => renderLocationItem(item, handleSelectStartLocation)}
                          style={styles.locationResultsList}
                          keyboardShouldPersistTaps="handled"
                        />
                      )}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Destination</Text>
                    <View style={styles.locationInputContainer}>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="flag-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="e.g., Yellowstone National Park"
                          value={endLocation}
                          onChangeText={handleEndLocationChange}
                          onFocus={() => setIsEndFocused(true)}
                          accessibilityLabel="Destination input"
                        />
                      </View>
                      {isEndFocused && endLocationResults.length > 0 && (
                        <FlatList
                          data={endLocationResults}
                          keyExtractor={(item) => item.placeId || item.description}
                          renderItem={({ item }) => renderLocationItem(item, handleSelectEndLocation)}
                          style={styles.locationResultsList}
                          keyboardShouldPersistTaps="handled"
                        />
                      )}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Maximum Daily Drive Time: {maxDriveHours} hours
                    </Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={2}
                      maximumValue={10}
                      step={0.5}
                      value={maxDriveHours}
                      onValueChange={setMaxDriveHours}
                      minimumTrackTintColor={COLORS.primary}
                      maximumTrackTintColor="#D8D8D8"
                      thumbTintColor={COLORS.secondary}
                      accessibilityLabel={`Maximum daily driving time, currently ${maxDriveHours} hours`}
                    />
                    <View style={styles.sliderLabels}>
                      <Text style={styles.sliderLabel}>2h</Text>
                      <Text style={styles.sliderLabel}>10h</Text>
                    </View>
                  </View>
                </View>
              )}

              {step === 2 && (
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>
                    What kind of scenery do you prefer?
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Select all that apply. We'll prioritize routes with these features.
                  </Text>

                  <View style={styles.sceneryContainer}>
                    {sceneryOptions.map(renderSceneryOption)}
                  </View>

                  <View style={styles.infoContainer}>
                    <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.infoText}>
                      Your selections will help us plan the most scenic route possible.
                      The more options you select, the more flexible we can be with the route.
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNextStep}
                disabled={isLoading}
                accessible={true}
                accessibilityLabel={step === 1 ? "Next Step" : "Calculate Route"}
                accessibilityHint={step === 1 ? "Move to scenery preferences" : "Creates your route and saves the trip"}
              >
                <Text style={styles.nextButtonText}>
                  {step === 1 ? 'Next Step' : 'Calculate Route'}
                </Text>
                <Ionicons 
                  name={step === 1 ? "arrow-forward" : "checkmark-circle"} 
                  size={20} 
                  color="white" 
                  style={styles.nextButtonIcon} 
                />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: COLORS.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: COLORS.text,
  },
  locationInputContainer: {
    position: 'relative',
    zIndex: 10,
  },
  locationResultsList: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 200,
    zIndex: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  locationIcon: {
    marginRight: 10,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationMainText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  locationSecondaryText: {
    fontSize: 12,
    color: COLORS.placeholder,
    marginTop: 2,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -10,
  },
  sliderLabel: {
    fontSize: 12,
    color: COLORS.placeholder,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.placeholder,
    marginBottom: 24,
  },
  sceneryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sceneryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: (width - 60) / 2,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 16,
  },
  sceneryOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sceneryIcon: {
    marginRight: 8,
  },
  sceneryLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  sceneryLabelSelected: {
    color: 'white',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButtonIcon: {
    marginLeft: 8,
  },
});

export default RoutePlannerScreen; 