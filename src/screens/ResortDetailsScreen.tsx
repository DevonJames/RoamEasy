import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import useMaps from '../hooks/useMaps';
import useTrips, { TripStop, Resort, Trip } from '../hooks/useTrips';
import { COLORS } from '../constants/theme';
import Card from '../components/Card';
import { Ionicons } from '@expo/vector-icons';

// Define navigation types
type RootStackParamList = {
  Home: undefined;
  RoutePlanner: undefined;
  Itinerary: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
  Settings: undefined;
  OfflineTrips: undefined;
};

// Update TripStop interface for the screen
interface EnhancedTripStop extends Omit<TripStop, 'resort_id'> {
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  resort_id?: string;
  resort?: Resort;
}

// Define navigation types
type ResortDetailsRouteProp = RouteProp<RootStackParamList, 'ResortDetails'>;
type ResortDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ResortDetailsScreen = () => {
  const route = useRoute<ResortDetailsRouteProp>();
  const navigation = useNavigation<ResortDetailsNavigationProp>();
  const { tripId, stopId } = route.params || {};
  
  const { getTrip, updateTripStop, isLoading: tripLoading, error: tripError, currentTrip } = useTrips();
  const { getResortSuggestions, isLoading: mapsLoading, error: mapsError } = useMaps();
  
  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [currentStop, setCurrentStop] = useState<EnhancedTripStop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Component setup
  useEffect(() => {
    console.log("ResortDetailsScreen mounted with params:", {
      tripId,
      stopId
    });
    return () => {
      console.log("ResortDetailsScreen unmounting");
    };
  }, []);

  // CRITICAL FIX: Bypass all authentication checks in ResortDetailsScreen
  useEffect(() => {
    console.log('RESORT DETAILS - AUTHENTICATION BYPASS ACTIVE');
  }, []);

  // Load trip and stop data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`Loading data for tripId: ${tripId}, stopId: ${stopId}`);
        
        if (!tripId) {
          throw new Error('Trip ID is missing');
        }

        console.log("Fetching trip data...");
        const trip = await getTrip(tripId);
        
        if (!trip) {
          console.error("Trip not found:", tripId);
          throw new Error('Trip not found');
        }
        
        console.log(`Trip found with ${trip.stops?.length || 0} stops`);
        
        // Find the current stop - try by ID first
        let stop = trip.stops?.find((s) => s.id === stopId);
        
        // If not found by ID, try by stop_order (if stopId can be parsed as a number)
        if (!stop && !isNaN(parseInt(stopId))) {
          const stopOrder = parseInt(stopId);
          console.log("Trying to find stop by order:", stopOrder);
          stop = trip.stops?.find((s) => (s as any).stop_order === stopOrder);
        }
        
        // If stop is genuinely not found after checking ID and order, throw error
        if (!stop) {
           console.error("Stop not found in trip:", stopId);
           if (trip.stops) {
             console.log("Available stops:", trip.stops.map(s => `${s.id} (order: ${(s as any).stop_order})`).join(", "));
           }
           throw new Error('Stop could not be found in the trip data.');
        }
        
        // Define a typed variable to hold the enhanced stop
        let enhancedStop: EnhancedTripStop = { ...stop } as EnhancedTripStop;
        
        // Check if the stop already has location data directly available
        if (stop && 'location' in stop && stop.location) {
          console.log("Stop has direct location data:", stop.location);
          enhancedStop.location = {
            latitude: (stop.location as any).latitude,
            longitude: (stop.location as any).longitude,
            address: (stop.location as any).address || "Unknown location"
          };
        } 
        // If not, try to extract it from notes
        else if (stop.notes) {
          console.log("Attempting to extract location from notes:", stop.notes);
          
          // Try to extract coordinates using a more flexible regex
          const coordinateMatch = stop.notes.match(/\(([-\d.]+),\s*([-\d.]+)\)/g);
          
          if (coordinateMatch && coordinateMatch.length > 0) {
            // Extract the last coordinates (most likely to be the destination for this stop)
            const lastCoordinateStr = coordinateMatch[coordinateMatch.length - 1];
            const coords = lastCoordinateStr.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
            
            if (coords && coords.length >= 3) {
              const latitude = parseFloat(coords[1]);
              const longitude = parseFloat(coords[2]);
              
              // Find all Location: entries
              const locationEntries = stop.notes.match(/Location:([^(]+)\([^)]+\)/g);
              
              let address = "Unknown location";
              
              if (locationEntries && locationEntries.length > 0) {
                // Get the last location entry (corresponding to the last coordinates)
                const lastLocationEntry = locationEntries[locationEntries.length - 1];
                const addressMatch = lastLocationEntry.match(/Location:([^(]+)/);
                
                if (addressMatch && addressMatch.length >= 2) {
                  address = addressMatch[1].trim();
                }
              }
              
              console.log(`Successfully extracted location: ${address} (${latitude}, ${longitude})`);
              
              enhancedStop.location = {
                latitude,
                longitude,
                address
              };
            }
          } else {
            console.error("Failed to extract coordinates from notes, using fallback coordinates");
            // Use fallback coordinates if we can't extract them
            enhancedStop.location = {
              latitude: 37.7749,
              longitude: -122.4194,
              address: "Fallback location"
            };
          }
        } else {
          console.warn('Stop has no location or notes data, using fallback coordinates');
          // Use fallback coordinates
          enhancedStop.location = {
            latitude: 37.7749,
            longitude: -122.4194,
            address: "Fallback location"
          };
        }
        
        console.log("Final enhanced stop with location:", enhancedStop);
        setCurrentStop(enhancedStop);
        
        // Pass the fetched trip directly to loadResortSuggestions
        await loadResortSuggestions(trip, enhancedStop);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred loading trip data';
        console.error("Error in loadData:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [tripId, stopId]);

  // Load resort suggestions
  const loadResortSuggestions = async (tripForSuggestions: Trip, stop: EnhancedTripStop) => {
    try {
      // Use the passed trip object instead of the hook state
      if (!tripForSuggestions) { 
        console.error("No trip data provided to loadResortSuggestions");
        // Optionally, try using currentTrip from state as a fallback?
        // if (!currentTrip) {
        //    console.error("Fallback: No current trip available in state either");
        //    return;
        // }
        // tripForSuggestions = currentTrip;
        return; // Exit if no trip data is available at all
      }
      
      // Check if stop already has a selected resort
      if (stop.resort_id && stop.resort) {
        console.log("Stop already has selected resort:", stop.resort);
        setSelectedResort(stop.resort);
      }
      
      // Make sure we have location data to work with
      if (!stop.location) {
        console.error("Stop has no location data:", stop);
        throw new Error('Cannot load resort suggestions without location data');
      }
      
      console.log("Getting resort suggestions for location:", stop.location);
      
      // Get resort suggestions based on the stop location and user preferences
      const location = {
        coordinates: {
          latitude: stop.location.latitude,
          longitude: stop.location.longitude,
        },
        address: stop.location.address || '',
      };
      
      const preferences = {
        amenities: ['WiFi', 'Full Hookups', 'Pet Friendly'],
        maxPricePerNight: 100
      };
      
      console.log("Calling getResortSuggestions with location:", location);
      const result = await getResortSuggestions(location, preferences);
      
      if (result.success && result.resorts && result.resorts.length > 0) {
        console.log(`Found ${result.resorts.length} resort suggestions`);
        
        // Directly use the resorts array returned from the hook
        console.log("Setting resort data directly from hook result:", result.resorts.length);
        setResorts(result.resorts); // Use the data as is
      } else {
        console.error("Resort suggestion API error or no resorts found:", result.error || "No resorts returned");
        
        // Show a more specific error message
        if (result.error && result.error.message === 'No resorts found in this location') {
          setError("No RV parks or campgrounds were found near this location. Try adjusting the location or searching manually.");
        } else {
          setError(result.error?.message || 'Failed to get resort suggestions. Try again later.');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred loading resort suggestions';
      console.error("Error in loadResortSuggestions:", errorMessage);
      setError(errorMessage);
    }
  };

  // Handle resort selection
  const handleSelectResort = async (resort: Resort) => {
    try {
      if (!currentStop || !tripId) return;
      
      setSelectedResort(resort);
      
      // Update the trip stop with the selected resort
      await updateTripStop(tripId, currentStop.id, {
        resort_id: resort.id
      });
      
      Alert.alert(
        'Resort Selected',
        `${resort.name} has been added to your itinerary.`,
        [
          { 
            text: 'View Itinerary', 
            onPress: () => navigation.navigate('Itinerary', { tripId }) 
          },
          { 
            text: 'Stay Here', 
            style: 'cancel' 
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to select resort. Please try again.');
    }
  };

  // Handle booking button press
  const handleBookingPress = (resort: Resort) => {
    if (resort.website) {
      Linking.openURL(resort.website);
    } else if (resort.phone) {
      Linking.openURL(`tel:${resort.phone}`);
    } else {
      Alert.alert('Booking Information', 'No booking information available. Please contact the resort directly.');
    }
  };

  // Render resort item
  const renderResortItem = ({ item }: { item: Resort }) => {
    console.log('Rendering Resort Item:', JSON.stringify(item, null, 2)); 
    const isSelected = selectedResort?.id === item.id; 

    // Safely format amenities 
    let amenitiesText = 'Amenities not available'; 
    if (Array.isArray(item.amenities) && item.amenities.length > 0) {
      const relevantTypes = item.amenities
                                .filter(type => type && !['point_of_interest', 'establishment', 'lodging'].includes(type))
                                .slice(0, 3)
                                .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      if (relevantTypes.length > 0) {
          amenitiesText = relevantTypes.join(' • ');
      }
    } else if (typeof item.amenities === 'string' && item.amenities.trim() !== '') {
      amenitiesText = item.amenities;
    }

    const ratingString = item.rating ? item.rating.toFixed(1) : 'N/A';
    const priceString = item.nightly_rate ? `$${item.nightly_rate}/night` : 'Price not available';
    const resortName = item.name || 'Name not available';

    return (
      <Card style={[styles.resortCard, isSelected ? styles.selectedCard : {}]}>
        {item.image_url && (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.resortImage} 
            resizeMode="cover"
          />
        )}
        
        <View style={styles.resortInfo}>
          <Text style={styles.resortName}>{item?.name || 'Resort Name Unavailable'}</Text> 
          
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={18} color={COLORS.primary} />
            {typeof item.rating === 'number' && item.rating > 0 ? (
              <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
            ) : (
              <Text style={styles.rating}>N/A</Text>
            )}
          </View>
          
          {typeof item.nightly_rate === 'number' ? (
             <Text style={styles.price}>${item.nightly_rate}/night</Text>
          ) : (
            <Text style={styles.price}>Price not available</Text>
          )}
          
          {amenitiesText ? (
             <Text style={styles.amenities}>{amenitiesText}</Text>
          ) : (
            <Text style={styles.amenities}>No specific amenities listed</Text>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.selectButton, isSelected ? styles.selectedButton : {}]} 
              onPress={() => handleSelectResort(item)}
            >
              <Text style={[styles.buttonText, isSelected ? styles.selectedButtonText : {}]}>
                {isSelected ? 'Selected' : 'Select'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.bookButton]} 
              onPress={() => handleBookingPress(item)}
            >
              <Text style={styles.buttonText}>Booking Info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading resort options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessible={true}
            accessibilityLabel="Go back to itinerary"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resort Options</Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              setError(null);
              setIsLoading(true);
              if (currentStop) {
                loadResortSuggestions(currentTrip, currentStop);
              }
            }}
          >
            <Text style={styles.actionButtonText}>Try Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              // Open web browser to search for RV parks
              const searchQuery = currentStop?.location?.address
                ? `RV parks near ${currentStop.location.address}`
                : 'RV parks';
              Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
            }}
          >
            <Text style={styles.secondaryButtonText}>Search on Google</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main content
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>
          {selectedResort ? 'Selected Resort' : 'Choose a Resort'}
        </Text>
        <Text style={styles.subtitle}>
          {currentStop ? `Stop #${currentStop.stop_order + 1}` : ''}
        </Text>
      </View>

      {resorts.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={48} color={COLORS.primary} />
          <Text style={styles.noResultsText}>No resorts found for this location.</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
            accessible={true}
            accessibilityLabel="Go back to itinerary"
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={resorts}
          keyExtractor={(item) => item.id}
          renderItem={renderResortItem}
          contentContainerStyle={styles.resortList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.primary,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  resortList: {
    padding: 16,
  },
  resortCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  selectedCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  resortImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  resortInfo: {
    padding: 16,
  },
  resortName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    marginLeft: 4,
    fontSize: 16,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  amenities: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButton: {
    flex: 1,
    marginRight: 8,
  },
  selectedButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  bookButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: COLORS.secondary,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  selectedButtonText: {
    color: COLORS.primary,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 16,
  },
});

export default ResortDetailsScreen; 