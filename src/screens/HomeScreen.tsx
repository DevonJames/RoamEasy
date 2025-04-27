import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import useTrips from '../hooks/useTrips';
import useAuth from '../hooks/useAuth';

// Define root stack param list type
type RootStackParamList = {
  Home: undefined;
  RoutePlanner: undefined;
  ItineraryScreen: { tripId: string };
  ResortDetailsScreen: { tripId: string, stopId: string };
  Settings: undefined;
  OfflineTrips: undefined;
};

// Type for the navigation prop
type HomeScreenNavigationProp = NavigationProp<RootStackParamList>;

interface TripCardProps {
  name: string;
  dateRange?: string;
  onPress: () => void;
}

const TripCard = ({ name, dateRange, onPress }: TripCardProps) => {
  return (
    <TouchableOpacity style={styles.tripCard} onPress={onPress} accessible={true} accessibilityLabel={`Trip ${name}, ${dateRange || ''}`}>
      <View style={styles.thumbnailPlaceholder} />
      <View style={styles.tripDetails}>
        <Text style={styles.tripName}>{name}</Text>
        {dateRange && <Text style={styles.tripDateRange}>{dateRange}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { trips, isLoading, error, loadTrips } = useTrips();
  const { user, isGuest } = useAuth();

  useEffect(() => {
    // Load trips when component mounts
    loadTrips();
  }, []);

  const handleCreateNewTrip = () => {
    navigation.navigate('RoutePlanner');
  };

  const handleTripPress = (tripId: string) => {
    navigation.navigate('ItineraryScreen', { tripId });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>You don't have any trips yet.</Text>
      <Text style={styles.emptyStateSubText}>Create a new trip to get started!</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>RoamEasy</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} accessible={true} accessibilityLabel="Settings">
          <View style={styles.profileIcon} />
        </TouchableOpacity>
      </View>

      <View style={styles.createTripContainer}>
        <TouchableOpacity 
          style={styles.createTripButton} 
          onPress={handleCreateNewTrip}
          accessible={true}
          accessibilityLabel="Create New Trip"
        >
          <Text style={styles.createTripButtonText}>Create New Trip</Text>
        </TouchableOpacity>
        {isGuest && (
          <Text style={styles.guestModeText}>
            Note: In guest mode, you can create but not save trips. Sign in to unlock all features.
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Your Trips</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading your trips...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading trips. Please try again.</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={loadTrips}
            accessible={true}
            accessibilityLabel="Retry loading trips"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // Create a date range string if we have stops
            let dateRange;
            if (item.stops && item.stops.length > 0) {
              const sortedStops = [...item.stops].sort((a, b) => a.stop_order - b.stop_order);
              const firstStop = sortedStops[0];
              const lastStop = sortedStops[sortedStops.length - 1];
              
              if (firstStop && lastStop) {
                const startDate = new Date(firstStop.check_in);
                const endDate = new Date(lastStop.check_out);
                const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
                const yearOptions: Intl.DateTimeFormatOptions = { year: 'numeric' };
                
                const startFormatted = startDate.toLocaleDateString('en-US', options);
                const endFormatted = endDate.toLocaleDateString('en-US', options);
                const yearFormatted = endDate.toLocaleDateString('en-US', yearOptions);
                
                dateRange = `${startFormatted} - ${endFormatted}, ${yearFormatted}`;
              }
            }
            
            return (
              <TripCard
                name={item.name}
                dateRange={dateRange}
                onPress={() => handleTripPress(item.id)}
              />
            );
          }}
          contentContainerStyle={[
            styles.tripsList,
            trips.length === 0 && styles.emptyListContainer
          ]}
          ListEmptyComponent={renderEmptyState()}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1', // Sand color from our palette
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32', // Forest Green from our palette
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7043', // Sunset Orange from our palette
  },
  createTripContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  createTripButton: {
    backgroundColor: '#2E7D32', // Forest Green from our palette
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  createTripButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  guestModeText: {
    marginTop: 8,
    color: '#FF7043', // Sunset Orange
    fontStyle: 'italic',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 8,
    color: '#37474F', // Charcoal from our palette
  },
  tripsList: {
    paddingHorizontal: 16,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  thumbnailPlaceholder: {
    width: 100,
    height: '100%',
    backgroundColor: '#42A5F5', // Sky Blue from our palette
  },
  tripDetails: {
    flex: 1,
    padding: 16,
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#37474F', // Charcoal from our palette
  },
  tripDateRange: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#37474F',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default HomeScreen; 