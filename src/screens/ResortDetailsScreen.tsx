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
import { AppStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import { COLORS } from '../constants/theme';

// Define navigation types
type RootStackParamList = {
  Home: undefined;
  RoutePlanner: undefined;
  Itinerary: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
  Settings: undefined;
  OfflineTrips: undefined;
};

// Update TripStop interface if needed
interface EnhancedTripStop extends TripStop {
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

  // Load trip and stop data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (!tripId || !stopId) {
          throw new Error('Trip ID or Stop ID is missing');
        }

        const trip = await getTrip(tripId);
        
        if (!trip) {
          throw new Error('Trip not found');
        }
        
        setCurrentTrip(trip);
        
        // Find the current stop
        const stop = trip.stops.find((s: TripStop) => s.id === stopId) as EnhancedTripStop;
        
        if (!stop) {
          throw new Error('Stop not found');
        }
        
        setCurrentStop(stop);
        
        // Load resort suggestions for this stop
        await loadResortSuggestions(stop);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred loading trip data';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [tripId, stopId]);

  // Load resort suggestions
  const loadResortSuggestions = async (stop: EnhancedTripStop) => {
    try {
      if (!currentTrip) return;
      
      // Check if stop already has a selected resort
      if (stop.resort_id) {
        setSelectedResort(stop.resort || null);
      }
      
      // Get resort suggestions based on the stop location and user preferences
      const location = stop.location || { 
        latitude: 0, 
        longitude: 0,
        address: ''
      };
      
      const preferences = {
        amenities: ['WiFi', 'Full Hookups', 'Pet Friendly'],
        maxPricePerNight: 100
      };
      
      const result = await getResortSuggestions(location, preferences);
      
      if (result.success && result.resorts) {
        setResorts(result.resorts);
      } else {
        throw new Error(result.error?.message || 'Failed to get resort suggestions');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred loading resort suggestions';
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
    const isSelected = selectedResort?.id === item.id;
    
    return (
      <Card style={[styles.resortCard, isSelected ? styles.selectedCard : null]}>
        {item.imageUrl && (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.resortImage} 
            resizeMode="cover"
          />
        )}
        
        <View style={styles.resortInfo}>
          <Text style={styles.resortName}>{item.name}</Text>
          
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={18} color={COLORS.primary} />
            <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
          </View>
          
          <Text style={styles.price}>${item.pricePerNight || item.nightly_rate}/night</Text>
          
          <Text style={styles.amenities}>
            {Array.isArray(item.amenities) 
              ? item.amenities.slice(0, 3).join(' • ') 
              : typeof item.amenities === 'string' 
                ? item.amenities 
                : ''}
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.selectButton, isSelected ? styles.selectedButton : null]} 
              onPress={() => handleSelectResort(item)}
            >
              <Text style={[styles.buttonText, isSelected ? styles.selectedButtonText : null]}>
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
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
            accessible={true}
            accessibilityLabel="Go back to itinerary"
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
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
});

export default ResortDetailsScreen; 