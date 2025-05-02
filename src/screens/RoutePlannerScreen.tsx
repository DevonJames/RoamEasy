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
  Dimensions,
  ImageBackground
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import useMaps from '../hooks/useMaps';
import { usePreferences } from '../hooks/usePreferences';
import useTrips, { TripStop } from '../hooks/useTrips';
import useAuth from '../hooks/useAuth';
import { debounce } from 'lodash';
import SupabaseService from '../services/SupabaseService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/environment';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import polyline from '@mapbox/polyline'; // For decoding polylines

// Define navigation types
type RootStackParamList = {
  HomeScreen: undefined;
  RoutePlanner: undefined;
  ItineraryScreen: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
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
  { id: 'coast', label: 'Coastal Views', icon: 'water-outline' as const, image: require('../assets/images/coastal.jpg') },
  { id: 'mountains', label: 'Mountain Passes', icon: 'triangle-outline' as const, image: require('../assets/images/mountains.jpg') },
  { id: 'forest', label: 'Forested Areas', icon: 'leaf-outline' as const, image: require('../assets/images/forest.jpg') },
  { id: 'rivers', label: 'Rivers & Lakes', icon: 'boat-outline' as const, image: require('../assets/images/rivers.jpg') },
  { id: 'desert', label: 'Desert Landscapes', icon: 'sunny-outline' as const, image: require('../assets/images/desert.jpg') },
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
  routeGeometry?: { latitude: number; longitude: number }[] | string;
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
  rvLength?: string;
  trailerLength?: string;
  hasPets?: boolean;
  costPreference?: string;
  hookupNeeds?: string;
  prepTime?: number;
  sceneryPriorities?: string[];
  scenery_preferences?: string[];
  driving_preferences?: {
    max_drive_hours?: number;
  };
}

// Update interface for the location object
interface Location {
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// Update the Location interface to match what the API returns
interface PlanningStop {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address: string;
}

interface RouteCalculationResult {
  success: boolean;
  routeResult?: RouteResult;
}

const RoutePlannerScreen = () => {
  const navigation = useNavigation<RoutePlannerScreenNavigationProp>();
  const { preferences, isLoading: prefsLoading } = usePreferences();
  const { planRoute, searchLocation, isLoading: mapsLoading } = useMaps();
  const { createTrip, isLoading: tripLoading } = useTrips();
  const { user, isAuthenticated, isGuest, forceRefreshAuth } = useAuth();

  // Form state
  const [tripName, setTripName] = useState('');
  const [startLocation, setStartLocation] = useState<string>('');
  const [endLocation, setEndLocation] = useState<string>('');
  const [startLocationResults, setStartLocationResults] = useState<LocationResult[]>([]);
  const [endLocationResults, setEndLocationResults] = useState<LocationResult[]>([]);
  const [maxDriveHours, setMaxDriveHours] = useState<number>(4);
  const [selectedScenery, setSelectedScenery] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationResult[]>([]);
  const [geocodedStart, setGeocodedStart] = useState<{ address: string; coordinates: { latitude: number; longitude: number } } | null>(null);
  const [geocodedEnd, setGeocodedEnd] = useState<{ address: string; coordinates: { latitude: number; longitude: number } } | null>(null);
  const [searchingLocation, setSearchingLocation] = useState<boolean>(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add state for trip start date and nights per stop
  const [tripStartDate, setTripStartDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [nightsPerStop, setNightsPerStop] = useState<number[]>([1, 1, 1, 1, 1]); // Default 1 night per stop

  // Add state for tooltip visibility
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  const isLoadingCombined = prefsLoading || mapsLoading || tripLoading || isLoading;
  const [activeSearchField, setActiveSearchField] = useState<'start' | 'end' | null>(null);

  // Add a state for the created trip ID
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);

  // Generate trip name based on locations and travel days
  const generateTripName = useCallback(() => {
    if (!startLocation || !endLocation) return '';
    
    const startCity = startLocation.split(',')[0].trim();
    const endCity = endLocation.split(',')[0].trim();
    
    // Calculate total travel days based on nights per stop
    const totalDays = nightsPerStop.reduce((sum, nights) => sum + nights, 0);
    
    return `${startCity} to ${endCity} (${totalDays} days)`;
  }, [startLocation, endLocation, nightsPerStop]);

  // Update trip name when locations or nights change
  useEffect(() => {
    const newTripName = generateTripName();
    if (newTripName) {
      setTripName(newTripName);
    }
  }, [startLocation, endLocation, nightsPerStop, generateTripName]);

  // Load preferences on mount
  useEffect(() => {
    if (preferences) {
      // Check if there are any scenery preferences (either format)
      if (preferences.sceneryPriorities && Array.isArray(preferences.sceneryPriorities)) {
        setSelectedScenery(preferences.sceneryPriorities);
      } else if (preferences.scenery_preferences && Array.isArray(preferences.scenery_preferences)) {
        setSelectedScenery(preferences.scenery_preferences);
      }
      
      // Check for driving hours preference (either format)
      if (preferences.driving_preferences?.max_drive_hours) {
        setMaxDriveHours(preferences.driving_preferences.max_drive_hours);
      }
    }
  }, [preferences]);

  // Search locations with debounce
  const debouncedSearchStart = useCallback(
    debounce(async (text: string) => {
      if (text.length > 2) {
        try {
          console.log(`Debounced search START for: ${text}`);
          const result = await searchLocation(text);
          if (result.success && result.locations) {
            // Correctly map Geocoding results
            const formattedResults = result.locations.map((loc: Location) => ({
              description: loc.address, // Use formatted_address
              placeId: loc.placeId || loc.address, // Use address as fallback ID
              mainText: loc.address.split(',')[0], // Derive mainText
              secondaryText: loc.address.split(',').slice(1).join(',').trim(), // Derive secondaryText
            }));
            console.log(`Setting ${formattedResults.length} start location results`);
            setStartLocationResults(formattedResults);
          } else {
            setStartLocationResults([]);
          }
        } catch (err) {
          console.error('Error during debounced start location search:', err);
          setStartLocationResults([]);
        }
      } else {
        setStartLocationResults([]);
      }
    }, 500), // 500ms debounce interval
    [searchLocation] // Dependency
  );

  const debouncedSearchEnd = useCallback(
    debounce(async (text: string) => {
      if (text.length > 2) {
        try {
          console.log(`Debounced search END for: ${text}`);
          const result = await searchLocation(text);
          if (result.success && result.locations) {
             // Correctly map Geocoding results
            const formattedResults = result.locations.map((loc: Location) => ({
              description: loc.address, // Use formatted_address
              placeId: loc.placeId || loc.address, // Use address as fallback ID
              mainText: loc.address.split(',')[0], // Derive mainText
              secondaryText: loc.address.split(',').slice(1).join(',').trim(), // Derive secondaryText
            }));
            console.log(`Setting ${formattedResults.length} end location results`);
            setEndLocationResults(formattedResults);
          } else {
            setEndLocationResults([]);
          }
        } catch (err) {
          console.error('Error during debounced end location search:', err);
          setEndLocationResults([]);
        }
      } else {
        setEndLocationResults([]);
      }
    }, 500), // 500ms debounce interval
    [searchLocation] // Dependency
  );

  // Location handling functions
  const handleStartLocationChange = (text: string) => {
    setStartLocation(text);
    setGeocodedStart(null); // Clear previous selection
    if (text.length > 2) {
      debouncedSearchStart(text); 
    } else {
      setStartLocationResults([]);
    }
  };

  const handleEndLocationChange = (text: string) => {
    setEndLocation(text);
    setGeocodedEnd(null); // Clear previous selection
    if (text.length > 2) {
      debouncedSearchEnd(text);
    } else {
      setEndLocationResults([]);
    }
  };

  // Handle selection of location from autocomplete results
  const handleSelectStartLocation = (item: LocationResult) => {
    setStartLocation(item.description);
    setStartLocationResults([]);
    setSearchingLocation(false);
  };

  const handleSelectEndLocation = (item: LocationResult) => {
    setEndLocation(item.description);
    setEndLocationResults([]);
    setSearchingLocation(false);
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
  const handleNextStep = async () => {
    if (currentStep === 1) {
      // Geocode locations before moving to step 2
      try {
        setIsLoading(true);
        const startGeo = await searchLocation(startLocation);
        const endGeo = await searchLocation(endLocation);
        setIsLoading(false);
        
        if (!startGeo.success || !startGeo.locations || startGeo.locations.length === 0 || 
            !endGeo.success || !endGeo.locations || endGeo.locations.length === 0) {
          setError('Could not find coordinates for start or end location. Please try a different address.');
          return;
        }
        
        // Store geocoded results (optional, but good practice)
        setGeocodedStart(startGeo.locations[0]); 
        setGeocodedEnd(endGeo.locations[0]);
        
        setError(null);
        setCurrentStep(2);
      } catch (err) {
        setIsLoading(false);
        setError('Failed to verify locations. Please check your connection.');
      }
      
    } else if (currentStep === 2) {
      if (selectedScenery.length === 0) {
        setError('Please select at least one scenery preference');
        return;
      }
      setError(null);
      setIsLoading(true); // Show loading for calculation AND trip creation
      
      try {
        // Calculate route first
        const routeCalcResult = await calculateRoute();
        
        if (!routeCalcResult.success || !routeCalcResult.routeResult) {
          throw new Error('Failed to calculate route. Please try again.');
        }
        
        // ---<<< CREATE TRIP HERE >>>---
        console.log("Route calculated, now creating the trip...");
        const tripId = await handlePlanRoute(routeCalcResult.routeResult); 
        
        if (!tripId) {
          throw new Error('Failed to create the trip after calculating route.');
        }
        // Trip ID is now set in state via handlePlanRoute
        
        setIsLoading(false);
        setCurrentStep(3); // Move to review screen *after* trip is created
        
      } catch (err) {
        setIsLoading(false);
        setError(err instanceof Error ? err.message : 'An error occurred.');
        console.error('Error during Step 2 -> Step 3 transition:', err);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  // Add a function to handle date changes
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setTripStartDate(selectedDate);
    }
  };

  // Add a function to handle changing nights for a specific stop
  const handleNightsChange = (index: number, nights: number) => {
    const updatedNights = [...nightsPerStop];
    updatedNights[index] = nights;
    setNightsPerStop(updatedNights);
  };

  // Calculate route using Maps service
  const calculateRoute = async (): Promise<RouteCalculationResult> => {
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
      console.log('Stops received from route planning:', result.stops.length);
      
      // Important fix: If we get stops directly from route planning or from result.stops, use those
      const planningStops = result.stops as unknown as PlanningStop[];
      console.log('Planning stops before processing:', result.stops);
      
      if (result.success && result.route && result.stops) {
        console.log('Stops received from route planning:', result.stops.length);
        console.log('Planning stops before processing:', result.stops);

        // Create a date object for the selected start date
        let currentDate = new Date(tripStartDate);
        
        // Map the planning stops to RouteStop format with proper dates
        const recommendedStops = planningStops.map((stop, index) => {
          // Create a copy of the current date
          const stopDate = new Date(currentDate);
          
          // For the next stop, add the number of nights from previous stop
          if (index > 0) {
            currentDate.setDate(currentDate.getDate() + (nightsPerStop[index-1] || 1));
          }
          
          return {
            date: stopDate.toISOString().split('T')[0],
            location: {
              latitude: stop.coordinates.latitude,
              longitude: stop.coordinates.longitude,
              address: stop.address || `Location near ${stop.coordinates.latitude}, ${stop.coordinates.longitude}`
            }
          };
        });

        console.log('Created recommendedStops from planning stops:', JSON.stringify(recommendedStops, null, 2));
        
        // ---> Log the correct polyline string <---
        const overviewPolyline = result.route.overviewPolyline; // Get the correct field
        console.log('Raw overview_polyline from planRoute:', JSON.stringify(overviewPolyline));
        
        const routeResult: RouteResult = {
          startCoords: result.route.waypoints[0].coordinates,
          endCoords: result.route.waypoints[1].coordinates,
          recommendedStops,
          routeGeometry: overviewPolyline // Assign the correct polyline string
        };
        
        setRouteResult(routeResult);
        return { success: true, routeResult };
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
        recommendedStops: [],
        routeGeometry: undefined
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
      setRouteResult(mockRouteResult);
      return { success: true, routeResult: mockRouteResult };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      throw new Error(errorMessage);
    }
  };

  // Create trip with calculated route
  const handlePlanRoute = async (calculatedRouteResult: RouteResult | null) => {
    if (!calculatedRouteResult || !calculatedRouteResult.recommendedStops || calculatedRouteResult.recommendedStops.length === 0) {
      Alert.alert('Error', 'Could not use calculated route data. Please try again.');
      return null;
    }

    setIsLoading(true);
    let effectiveUserId: string | null = null;
    
    try {
      // ---<<< GET FRESH AUTH STATE >>>---
      console.log('handlePlanRoute: Re-fetching current user session...');
      const { user: currentUser, error: authError } = await SupabaseService.getCurrentUser();
      
      if (authError || !currentUser) {
        console.error('handlePlanRoute: Failed to get current user or session invalid:', authError);
        throw new Error('User not authenticated. Please sign in again.');
      } else {
        console.log('handlePlanRoute: Found active session for user:', currentUser.id);
        effectiveUserId = currentUser.id;
      }
      
      if (!effectiveUserId) {
         throw new Error('Could not determine a valid user ID.'); 
      }
      
      // ---> Explicitly refresh the session <--- 
      try {
        console.log('handlePlanRoute: Attempting explicit session refresh...');
        const { error: refreshError } = await SupabaseService.getClient().auth.refreshSession();
        if (refreshError) {
          console.warn('handlePlanRoute: Session refresh failed:', refreshError.message);
          // Don't necessarily block, but log the warning
        } else {
          console.log('handlePlanRoute: Session refresh successful.');
        }
      } catch (refreshException) {
        console.error('handlePlanRoute: Exception during session refresh:', refreshException);
      }

      // Generate trip name if it's not set
      let currentTripName = tripName;
      if (!currentTripName) {
        const generatedName = generateTripName();
        setTripName(generatedName);
        currentTripName = generatedName;
      }
      
      console.log('Using effective user ID for trip creation:', effectiveUserId);
      
      // Create trip data USING THE PASSED-IN ARGUMENT
      const tripData = {
        name: currentTripName,
        user_id: effectiveUserId,
        start_location: {
          address: calculatedRouteResult.recommendedStops[0].location.address,
          latitude: calculatedRouteResult.recommendedStops[0].location.latitude,
          longitude: calculatedRouteResult.recommendedStops[0].location.longitude,
        },
        end_location: {
          address: calculatedRouteResult.recommendedStops[calculatedRouteResult.recommendedStops.length - 1].location.address,
          latitude: calculatedRouteResult.recommendedStops[calculatedRouteResult.recommendedStops.length - 1].location.latitude,
          longitude: calculatedRouteResult.recommendedStops[calculatedRouteResult.recommendedStops.length - 1].location.longitude,
        },
        status: 'planned' as const,
      };
      
      console.log('Attempting to create trip with this data:', JSON.stringify(tripData, null, 2));

      // Direct call to createTrip
      const result = await createTrip(tripData);

      if (result.error || !result.trip) {
        console.error(`Trip creation failed:`, result.error);
        throw new Error(`Failed to create trip: ${result.error?.message || 'Unknown error'}`);
      }

      const trip = result.trip;
      const tripId = trip.id;
      console.log('Trip created successfully, ID:', tripId);
      
      // Add stops using the PASSED-IN ARGUMENT
      const tripStops: TripStop[] = [];
      const maxStopRetries = 2;

      for (let i = 0; i < calculatedRouteResult.recommendedStops.length; i++) {
        const stop = calculatedRouteResult.recommendedStops[i];
        const locationNote = `Location: ${stop.location.address} (${stop.location.latitude}, ${stop.location.longitude})`;
        const checkInDate = new Date(stop.date);
        const nightsAtStop = nightsPerStop[i] || 1;
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkOutDate.getDate() + nightsAtStop);
        
        const stopData = {
          resort_id: null, 
          stop_order: i,
          check_in: checkInDate.toISOString().split('T')[0],
          check_out: checkOutDate.toISOString().split('T')[0],
          notes: locationNote,
        };
        
        let stopResult: TripStop | null = null;
        let stopRetryCount = 0;
        while (!stopResult && stopRetryCount < maxStopRetries) {
          console.log(`Adding stop ${i} (order ${stopData.stop_order}) attempt ${stopRetryCount + 1}:`, stopData);
          const addResult = await SupabaseService.addTripStop(tripId, stopData);
          
          if (addResult.error) {
            console.error(`Failed to add stop ${i} (attempt ${stopRetryCount + 1}):`, addResult.error);
            if (addResult.error.message?.includes('authent')) {
              await new Promise(resolve => setTimeout(resolve, 500));
              stopRetryCount++;
            } else {
              break; 
            }
          } else {
            stopResult = addResult.stop;
            break;
          }
        }
        
        if (stopResult) {
          tripStops.push(stopResult);
        } else {
          console.warn(`Could not add stop ${i} after ${maxStopRetries} attempts`);
        }
      }
      
      console.log(`Added ${tripStops.length} / ${calculatedRouteResult.recommendedStops.length} stops to trip ${tripId}`);
      
      setCreatedTripId(tripId); 
      
      setIsLoading(false);
      return tripId;
      
    } catch (error) {
      console.error('Error in handlePlanRoute:', error);
      setIsLoading(false);
      Alert.alert('Error', `Failed to create trip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  // Add a new function to handle viewing resort options
  const handleViewResortOptions = async (stopIndex: number) => {
    console.log('View resort options for stop:', stopIndex);
    
    // Trip ID should exist by the time this screen is visible
    if (!createdTripId) {
      console.error('Error: createdTripId is missing when trying to view resort options.');
      Alert.alert('Error', 'Cannot view resort options because the trip ID is missing. Please go back and try again.');
      return;
    }

    try {
      // Now we have a tripId, proceed with navigation
      console.log(`Navigating to resort details with tripId: ${createdTripId}, stopId: ${stopIndex}`);
      
      // Store navigation data just in case
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('lastTripId', createdTripId);
        await AsyncStorage.setItem('lastStopIndex', stopIndex.toString());
        console.log('Stored navigation data in AsyncStorage for recovery');
      } catch (error) {
        console.error('Failed to store navigation data:', error);
      }
      
      // Navigate to the ResortDetails screen
      navigation.navigate('ResortDetails', {
        tripId: createdTripId,
        stopId: stopIndex.toString()
      });

    } catch (error) {
      console.error('Error navigating to resort details:', error);
      Alert.alert('Error', 'Could not navigate to resort options. Please try again.');
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
  const renderSceneryOption = (item: { id: string, label: string, icon: keyof typeof Ionicons.glyphMap, image: any }) => {
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
        <ImageBackground 
          source={item.image} 
          style={styles.sceneryBackground}
          imageStyle={{ borderRadius: 8, opacity: 0.85 }}
        >
          <View style={[styles.sceneryContent, isSelected && styles.sceneryContentSelected]}>
            <Ionicons 
              name={item.icon} 
              size={28} 
              color={isSelected ? 'white' : COLORS.primary} 
              style={styles.sceneryIcon} 
            />
            <Text style={[styles.sceneryLabel, isSelected && styles.sceneryLabelSelected]}>
              {item.label}
            </Text>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  // Add UI for date selection and nights per stop in the proper step
  const renderLocationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where are you going?</Text>
      <Text style={styles.stepDescription}>Enter your starting point and destination.</Text>
      
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
              onFocus={() => setActiveSearchField('start')}
              accessibilityLabel="Starting location input"
            />
          </View>
          {activeSearchField === 'start' && startLocationResults.length > 0 && (
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
              onFocus={() => setActiveSearchField('end')}
              accessibilityLabel="Destination input"
            />
          </View>
          {activeSearchField === 'end' && endLocationResults.length > 0 && (
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
      
      {/* Trip Start Date Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Trip Start Date</Text>
        <TouchableOpacity 
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateText}>{tripStartDate.toLocaleDateString()}</Text>
          <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      
      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={tripStartDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()} // Can't select dates in the past
            style={styles.datePicker}
          />
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Maximum Driving Hours Per Day: {maxDriveHours} hours
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
      
      <TouchableOpacity
        style={[
          styles.nextButton,
          (!geocodedStart || !geocodedEnd) && styles.disabledButton
        ]}
        onPress={handleNextStep}
        disabled={!geocodedStart || !geocodedEnd}
      >
        <Text style={styles.nextButtonText}>Next: Scenery Preferences</Text>
        <Ionicons name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );

  // Update the UI to use the new function
  const renderRouteReviewStep = () => {
    if (!routeResult || !routeResult.recommendedStops || routeResult.recommendedStops.length === 0) {
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>No Route Calculated</Text>
          <Text style={styles.stepDescription}>Please go back and calculate a route first.</Text>
          <TouchableOpacity style={styles.backButton} onPress={handlePreviousStep}>
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // ---> Decode Polyline if it's a string <--- 
    let routeCoordinates: { latitude: number; longitude: number }[] = [];
    if (typeof routeResult.routeGeometry === 'string') {
      try {
        routeCoordinates = polyline.decode(routeResult.routeGeometry).map(point => ({ latitude: point[0], longitude: point[1] }));
      } catch (e) {
        console.error("Failed to decode polyline:", e);
        // Fallback or error handling if decode fails
      }
    } else if (Array.isArray(routeResult.routeGeometry)) {
      // Assume it's already an array of coordinates
      routeCoordinates = routeResult.routeGeometry;
    }
    
    // Calculate initial map region to fit the route
    let initialRegion = undefined;
    if (routeCoordinates.length > 0) {
        // Basic bounding box calculation (can be improved)
        const latitudes = routeCoordinates.map(p => p.latitude);
        const longitudes = routeCoordinates.map(p => p.longitude);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);
        
        initialRegion = {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: (maxLat - minLat) * 1.4, // Add padding
            longitudeDelta: (maxLng - minLng) * 1.4, // Add padding
        };
    }

    // ---> Log decoded coordinates and calculated region <--- 
    console.log(`Decoded routeCoordinates length: ${routeCoordinates.length}`);
    if (initialRegion) {
      console.log('Calculated initialRegion:', JSON.stringify(initialRegion));
    } else {
      console.log('Initial region could not be calculated.');
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Review Your Trip</Text>
        <Text style={styles.tripNameDisplay}>{tripName}</Text>
        <Text style={styles.stepDescription}>Review your itinerary and customize nights per stop.</Text>
        
        {/* ---> Add MapView Here <--- */} 
        {routeCoordinates.length > 0 && (
          <MapView
            style={styles.mapView}
            provider={PROVIDER_GOOGLE} // Use Google Maps
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsPointsOfInterest={false}
          >
            {/* ---> TEMPORARILY COMMENT OUT POLYLINE AND MARKERS <--- */}
            {/* 
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={COLORS.primary} // Route color
              strokeWidth={4}
            />
            
            {routeResult.recommendedStops.map((stop, index) => (
              <Marker
                key={`stop-marker-${index}`}
                coordinate={stop.location} // Use the location object directly
                title={`Stop ${index + 1}`}
                description={stop.location.address}
                pinColor={index === 0 ? 'green' : index === routeResult.recommendedStops.length - 1 ? 'red' : 'blue'}
              />
            ))}
            */}
          </MapView>
        )}

        <FlatList
          data={routeResult.recommendedStops}
          keyExtractor={(item, index) => `stop-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.stopCard}>
              <View style={styles.stopHeader}>
                <Text style={styles.stopNumber}>Stop {index + 1}</Text>
                <Text style={styles.stopDate}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              
              <Text style={styles.stopAddress}>{item.location.address}</Text>
              
              <View style={styles.stopActions}>
                {/* Add nights control for each stop */}
                <View style={styles.nightsContainer}>
                  <Text style={styles.nightsLabel}>Nights at this stop:</Text>
                  <View style={styles.nightsControl}>
                    <TouchableOpacity 
                      style={styles.nightsButton}
                      onPress={() => handleNightsChange(index, Math.max(1, nightsPerStop[index] - 1))}
                    >
                      <Ionicons name="remove" size={18} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.nightsValue}>{nightsPerStop[index] || 1}</Text>
                    <TouchableOpacity 
                      style={styles.nightsButton}
                      onPress={() => handleNightsChange(index, (nightsPerStop[index] || 1) + 1)}
                    >
                      <Ionicons name="add" size={18} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.resortButton}
                  onPress={() => handleViewResortOptions(index)}
                >
                  <Ionicons name="business-outline" size={18} color="white" />
                  <Text style={styles.resortButtonText}>View Resort Options</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          style={styles.stopsList}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backButton} onPress={handlePreviousStep}>
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.planButton} 
            onPress={() => handlePlanRoute(routeResult)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.planButtonText}>Plan Route</Text>
                <Ionicons name="checkmark-circle" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
              {currentStep === 1 ? 'Plan Your Route' : 
               currentStep === 2 ? 'Scenery Preferences' : 
               'Review Your Trip'}
            </Text>
            {currentStep > 1 && (
              <TouchableOpacity 
                onPress={handlePreviousStep}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
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
              <Text style={styles.loadingText}>
                {isLoading ? 'Planning your perfect route...' : 'Loading...'}
              </Text>
            </View>
          ) : (
            <>
              {currentStep === 1 && renderLocationStep()}

              {currentStep === 2 && (
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>
                    What kind of scenery do you prefer?
                  </Text>
                  <View style={styles.subtitleContainer}>
                    <Text style={styles.sectionSubtitle}>
                      Select all that apply. We'll prioritize routes with these features.{' '}
                      <TouchableOpacity 
                        onPress={() => setShowTooltip(!showTooltip)}
                        style={styles.inlineInfoButton}
                        accessible={true}
                        accessibilityLabel="More information about scenery selection"
                        accessibilityHint="Displays additional information about how scenery preferences work"
                      >
                        <Text style={styles.infoButtonText}>More Info</Text>
                        <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </Text>
                  </View>

                  {showTooltip && (
                    <View style={styles.tooltipContainer}>
                      <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.infoText}>
                        Your selections will help us plan the most scenic route possible.
                        The more options you select, the more flexible we can be with the route.
                      </Text>
                      <TouchableOpacity 
                        onPress={() => setShowTooltip(false)}
                        style={styles.closeTooltipButton}
                        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      >
                        <Ionicons name="close" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.sceneryContainer}>
                    {sceneryOptions.map(renderSceneryOption)}
                  </View>
                </View>
              )}

              {currentStep === 3 && renderRouteReviewStep()}

              {currentStep < 3 && (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNextStep}
                  disabled={isLoading}
                  accessible={true}
                  accessibilityLabel={currentStep === 1 ? "Next Step" : "Calculate Route"}
                  accessibilityHint={currentStep === 1 ? "Move to scenery preferences" : "Creates your route and saves the trip"}
                >
                  <Text style={styles.nextButtonText}>
                    {currentStep === 1 ? 'Next Step' : 'Calculate Route'}
                  </Text>
                  <Ionicons 
                    name={currentStep === 1 ? "arrow-forward" : "checkmark-circle"} 
                    size={20} 
                    color="white" 
                    style={styles.nextButtonIcon} 
                  />
                </TouchableOpacity>
              )}
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
    lineHeight: 20,
  },
  sceneryContainer: {
    width: '100%',
    marginBottom: 0,
  },
  sceneryOption: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    height: 80,
  },
  sceneryOptionSelected: {
    borderColor: COLORS.secondary,
    borderWidth: 2,
  },
  sceneryBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  sceneryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    width: '100%',
    height: '100%',
  },
  sceneryContentSelected: {
    backgroundColor: 'rgba(46, 125, 50, 0.85)', // Semi-transparent primary color
  },
  sceneryIcon: {
    marginRight: 12,
  },
  sceneryLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.text,
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
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.placeholder,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  datePickerContainer: {
    marginBottom: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  datePicker: {
    width: '100%',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
  },
  stopCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stopNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  stopDate: {
    fontSize: 14,
    color: '#666',
  },
  stopAddress: {
    fontSize: 15,
    marginBottom: 10,
  },
  nightsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  nightsLabel: {
    fontSize: 14,
    color: '#666',
  },
  nightsControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nightsButton: {
    backgroundColor: COLORS.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nightsValue: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  suggestionsList: {
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  planButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  stopsList: {
    flex: 1,
  },
  sliderValue: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    marginLeft: 4,
  },
  tripNameDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  stopActions: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resortButton: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  resortButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  mapView: {
    height: 250, // Adjust height as needed
    width: '100%',
    marginBottom: 20,
    borderRadius: 8,
  },
  subtitleContainer: {
    marginBottom: 16,
  },
  inlineInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  tooltipContainer: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  closeTooltipButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    marginRight: 4,
    fontWeight: '500',
  },
});

export default RoutePlannerScreen; 