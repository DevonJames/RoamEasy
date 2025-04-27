import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView 
} from 'react-native';

// Interface for trip items
interface OfflineTripItem {
  id: string;
  name: string;
  dateRange: string;
  stops: number;
  lastUpdated: string;
  thumbnailType: 'mountain' | 'beach' | 'forest';
}

// Mock data for offline trips
const MOCK_OFFLINE_TRIPS: OfflineTripItem[] = [
  {
    id: '1',
    name: 'Summer Mountain Trip',
    dateRange: 'Jun 15 - Jun 30, 2023',
    stops: 5,
    lastUpdated: '2023-05-20',
    thumbnailType: 'mountain'
  },
  {
    id: '2',
    name: 'Coastal Adventure',
    dateRange: 'Jul 10 - Jul 25, 2023',
    stops: 4,
    lastUpdated: '2023-05-18',
    thumbnailType: 'beach'
  },
  {
    id: '3',
    name: 'Forest Retreat',
    dateRange: 'Aug 5 - Aug 15, 2023',
    stops: 3,
    lastUpdated: '2023-05-15',
    thumbnailType: 'forest'
  }
];

// Trip card component
const TripCard = ({ trip, onPress }: { trip: OfflineTripItem, onPress: () => void }) => {
  // Function to get background color based on thumbnail type
  const getThumbnailColor = (type: 'mountain' | 'beach' | 'forest') => {
    switch (type) {
      case 'mountain':
        return '#2E7D32'; // Forest Green
      case 'beach':
        return '#42A5F5'; // Sky Blue
      case 'forest':
        return '#558B2F'; // Darker Green
      default:
        return '#FF7043'; // Sunset Orange
    }
  };

  return (
    <TouchableOpacity style={styles.tripCard} onPress={onPress}>
      <View 
        style={[
          styles.thumbnailContainer, 
          { backgroundColor: getThumbnailColor(trip.thumbnailType) }
        ]}
      >
        <Text style={styles.thumbnailText}>
          {trip.thumbnailType === 'mountain' ? '⛰️' :
           trip.thumbnailType === 'beach' ? '🏖️' : '🌲'}
        </Text>
      </View>
      
      <View style={styles.tripDetails}>
        <Text style={styles.tripName}>{trip.name}</Text>
        <Text style={styles.tripDateRange}>{trip.dateRange}</Text>
        <Text style={styles.tripStops}>{trip.stops} Stops</Text>
        
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineBadgeText}>Available Offline</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const OfflineTripsScreen = () => {
  // Handle opening a trip
  const handleOpenTrip = (tripId: string) => {
    console.log(`Opening offline trip with ID: ${tripId}`);
    // In a real app, this would navigate to the trip details screen
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Offline Trips</Text>
        <Text style={styles.headerSubtitle}>
          These trips are available without an internet connection
        </Text>
      </View>

      {MOCK_OFFLINE_TRIPS.length > 0 ? (
        <FlatList
          data={MOCK_OFFLINE_TRIPS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripCard 
              trip={item}
              onPress={() => handleOpenTrip(item.id)}
            />
          )}
          contentContainerStyle={styles.tripsList}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateTitle}>No Offline Trips</Text>
          <Text style={styles.emptyStateText}>
            Your saved trips will appear here for offline access.
            Create a trip and save it to view it offline.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1', // Sand color
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#37474F', // Charcoal
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  tripsList: {
    padding: 16,
  },
  tripCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailText: {
    fontSize: 32,
  },
  tripDetails: {
    flex: 1,
    padding: 16,
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#37474F', // Charcoal
    marginBottom: 4,
  },
  tripDateRange: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tripStops: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  offlineBadge: {
    backgroundColor: '#E8F5E9', // Light green
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2E7D32', // Forest Green
  },
  offlineBadgeText: {
    color: '#2E7D32', // Forest Green
    fontSize: 12,
    fontWeight: '500',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#37474F', // Charcoal
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default OfflineTripsScreen; 