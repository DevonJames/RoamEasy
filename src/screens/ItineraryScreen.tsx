import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  SafeAreaView,
  Share,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import useTrips, { Trip, TripStop as BaseTripStop } from '../hooks/useTrips';
import CalendarService from '../services/CalendarService';
import { format } from 'date-fns';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapsService, { Coordinates } from '../services/MapsService';

// Define the extended TripStop interface with location property
interface TripStop extends BaseTripStop {
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

// Define the navigation types
type RootStackParamList = {
  Home: undefined;
  RoutePlanner: undefined;
  ItineraryScreen: { tripId: string };
  ResortDetails: { tripId: string, stopId: string };
  Settings: undefined;
  OfflineTrips: undefined;
};

type ItineraryScreenRouteProp = RouteProp<RootStackParamList, 'ItineraryScreen'>;
type ItineraryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ItineraryScreen = () => {
  const route = useRoute<ItineraryScreenRouteProp>();
  const navigation = useNavigation<ItineraryScreenNavigationProp>();
  const { tripId } = route.params;
  
  const { getTrip, updateTripStop, reorderTripStops, exportTripToCalendar, isLoading, error, currentTrip, updateTrip } = useTrips();
  
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Add state for map region
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Add a state to track map errors
  const [mapError, setMapError] = useState<boolean>(false);

  // Add state for route data and directions
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // Add state for map expansion
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

  useEffect(() => {
    // Load the trip details when component mounts
    if (tripId) {
      console.log('ItineraryScreen: Loading trip with ID:', tripId);
      getTrip(tripId).then(loadedTrip => {
        if (loadedTrip) {
          console.log('ItineraryScreen: Trip loaded:', loadedTrip.id);
          console.log('ItineraryScreen: Trip has', loadedTrip.stops?.length || 0, 'stops');
          
          // Check for the trip_stops field (from Supabase nested query)
          // Using type assertion since trip_stops is defined in the backend response
          const tripWithStops = loadedTrip as Trip & { trip_stops?: TripStop[] };
          if (tripWithStops.trip_stops && tripWithStops.trip_stops.length > 0) {
            console.log('ItineraryScreen: Found trip_stops:', tripWithStops.trip_stops.length);
            console.log('ItineraryScreen: Trip stops data:', JSON.stringify(tripWithStops.trip_stops, null, 2));
            
            // Copy trip_stops to stops if stops is empty
            if (!loadedTrip.stops || loadedTrip.stops.length === 0) {
              console.log('ItineraryScreen: Copying trip_stops to stops array');
              
              // Update currentTrip in the state to include stops from trip_stops
              updateTrip(loadedTrip.id, {
                stops: tripWithStops.trip_stops
              });
            }
          } else {
            console.log('ItineraryScreen: No trip_stops found in loaded trip');
          }
        } else {
          console.log('ItineraryScreen: No trip loaded');
        }
      });
    }
  }, [tripId]);

  // Add a function to calculate the map region based on stops
  useEffect(() => {
    if (currentTrip?.stops && currentTrip.stops.length > 0) {
      // Calculate bounds of all stop locations
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      
      // Iterate through stops to find bounds
      currentTrip.stops.forEach((stop: TripStop) => {
        // Try to extract coordinates from location property or notes
        let lat, lng;
        
        if (stop.location) {
          lat = stop.location.latitude;
          lng = stop.location.longitude;
        } else if (stop.notes) {
          // Try to extract coordinates from notes using regex
          const coordinateMatch = stop.notes.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
          if (coordinateMatch && coordinateMatch.length >= 3) {
            lat = parseFloat(coordinateMatch[1]);
            lng = parseFloat(coordinateMatch[2]);
          }
        }
        
        // Update bounds if we found coordinates
        if (lat && lng) {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        }
      });
      
      // If we found valid bounds
      if (minLat !== Infinity && maxLat !== -Infinity) {
        // Calculate center point
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        
        // Calculate span with padding
        const latDelta = (maxLat - minLat) * 1.4;
        const lngDelta = (maxLng - minLng) * 1.4;
        
        setMapRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: Math.max(latDelta, 0.01),
          longitudeDelta: Math.max(lngDelta, 0.01),
        });
      }
    }
  }, [currentTrip?.stops]);

  // Add useEffect to load route data
  useEffect(() => {
    const fetchRouteData = async () => {
      if (!currentTrip?.stops || currentTrip.stops.length < 2) {
        return;
      }

      try {
        setIsLoadingRoute(true);
        console.log('Fetching route data for trip with stops:', currentTrip.stops.length);
        
        // Sort stops by order
        const sortedStops = [...currentTrip.stops].sort((a, b) => a.stop_order - b.stop_order);
        
        // Get coordinates for each stop
        const stopCoordinates = sortedStops.map((stop: TripStop) => {
          if (stop.location) {
            return {
              latitude: stop.location.latitude,
              longitude: stop.location.longitude,
            };
          } else if (stop.notes) {
            // Try to extract coordinates from notes using regex
            const coordinateMatch = stop.notes.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
            if (coordinateMatch && coordinateMatch.length >= 3) {
              return {
                latitude: parseFloat(coordinateMatch[1]),
                longitude: parseFloat(coordinateMatch[2])
              };
            }
          }
          return null;
        }).filter(coord => coord !== null);
        
        console.log('Valid stop coordinates:', stopCoordinates.length);
        
        if (stopCoordinates.length >= 2) {
          // Get route data for each pair of consecutive stops
          const allRoutePoints: Coordinates[] = [];
          
          for (let i = 0; i < stopCoordinates.length - 1; i++) {
            console.log(`Getting route from stop ${i} to ${i+1}`);
            
            const origin = {
              coordinates: stopCoordinates[i],
              address: sortedStops[i].notes || ''
            };
            
            const destination = {
              coordinates: stopCoordinates[i + 1],
              address: sortedStops[i + 1].notes || ''
            };
            
            // Get route using MapsService
            const { route, error } = await MapsService.getRoute(origin, destination);
            
            if (route && !error) {
              console.log(`Route found for segment ${i} to ${i+1}:`, route.totalDistance, 'meters');
              
              // The route object should contain decoded coordinates
              if (route.legs && route.legs.length > 0) {
                // Extract coordinates from route steps
                route.legs.forEach(leg => {
                  if (leg.steps && leg.steps.length > 0) {
                    leg.steps.forEach(step => {
                      allRoutePoints.push(step.startLocation);
                    });
                    // Add the end location of the last step
                    if (leg.steps.length > 0) {
                      allRoutePoints.push(leg.steps[leg.steps.length - 1].endLocation);
                    }
                  }
                });
              } else if (route.waypoints && route.waypoints.length > 0) {
                // Use waypoints directly if available
                route.waypoints.forEach(waypoint => {
                  if (waypoint.coordinates) {
                    allRoutePoints.push(waypoint.coordinates);
                  }
                });
              }
            } else {
              console.error('Failed to get route:', error);
            }
          }
          
          console.log('Total route points:', allRoutePoints.length);
          
          // Set route coordinates for display
          if (allRoutePoints.length > 0) {
            setRouteCoordinates(allRoutePoints);
          } else {
            // Fallback to direct lines if no route data
            console.log('No route data found, using direct lines');
            setRouteCoordinates(stopCoordinates);
          }
        }
      } catch (error) {
        console.error('Failed to fetch route data:', error);
      } finally {
        setIsLoadingRoute(false);
      }
    };
    
    fetchRouteData();
  }, [currentTrip?.stops]);

  // Handle note editing
  const startEditingNotes = (stopId: string, currentNotes: string = '') => {
    setEditingNotes(stopId);
    setNoteText(currentNotes);
  };

  // Save edited notes
  const saveNotes = async (stopId: string) => {
    if (!currentTrip) return;
    
    try {
      await updateTripStop(currentTrip.id, stopId, { notes: noteText });
      setEditingNotes(null);
    } catch (err) {
      Alert.alert('Error', 'Failed to save notes. Please try again.');
    }
  };

  // Swap the position of two stops
  const moveStop = async (fromIndex: number, toIndex: number) => {
    if (!currentTrip?.stops || toIndex < 0 || toIndex >= currentTrip.stops.length) return;
    
    try {
      const newOrder = [...currentTrip.stops].map((stop, i) => ({
        id: stop.id,
        stop_order: i === fromIndex ? toIndex : 
                  i === toIndex ? fromIndex : i
      }));
      
      await reorderTripStops(currentTrip.id, newOrder);
    } catch (err) {
      Alert.alert('Error', 'Failed to reorder stops. Please try again.');
    }
  };

  // Share the itinerary via email or other share options
  const shareItinerary = async () => {
    if (!currentTrip || !currentTrip.stops) return;
    
    try {
      const formattedItinerary = currentTrip.stops
        .sort((a, b) => a.stop_order - b.stop_order)
        .map((stop, index) => {
          const checkInDate = new Date(stop.check_in);
          const checkOutDate = new Date(stop.check_out);
          const resort = stop.resort || { name: 'TBD', address: 'Location TBD' };
          
          // Check if resort has phone property
          const hasPhone = resort && 'phone' in resort && resort.phone;
          
          return (
            `Day ${index + 1}: ${resort.name}\n` +
            `Date: ${format(checkInDate, 'MMM d, yyyy')}\n` +
            `Location: ${resort.address}\n` +
            `Check-in: ${format(checkInDate, 'h:mm a')} | Check-out: ${format(checkOutDate, 'h:mm a')}\n` +
            `${stop.booking_info?.site_number ? `Site #: ${stop.booking_info.site_number}\n` : ''}` +
            `${hasPhone ? `Phone: ${resort.phone}\n` : ''}` +
            `${stop.notes ? `Notes: ${stop.notes}\n` : ''}` +
            '-------------------'
          );
        })
        .join('\n\n');

      await Share.share({
        title: `${currentTrip.name} Itinerary`,
        message: `RoamEasy Trip: ${currentTrip.name}\n\n${formattedItinerary}`,
      });
    } catch (error) {
      console.error('Error sharing itinerary:', error);
      Alert.alert('Error', 'Failed to share itinerary. Please try again.');
    }
  };

  // Export to calendar
  const exportToCalendar = async (calendarType: 'google' | 'icloud' | 'ical') => {
    if (!currentTrip) return;
    
    try {
      const result = await exportTripToCalendar(currentTrip.id, calendarType);
      
      if (result.success) {
        Alert.alert('Success', `Itinerary exported to ${calendarType} calendar successfully.`);
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Export Failed', `Could not export to calendar: ${errorMsg}`);
    }
  };

  const showExportOptions = () => {
    Alert.alert(
      'Export Calendar',
      'Choose a calendar type',
      [
        { text: 'Google Calendar', onPress: () => exportToCalendar('google') },
        { text: 'Apple Calendar', onPress: () => exportToCalendar('icloud') },
        { text: 'Export iCal File', onPress: () => exportToCalendar('ical') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Navigation to resort details
  const navigateToResortDetails = (stopId: string) => {
    if (!currentTrip) return;
    navigation.navigate('ResortDetails', { tripId: currentTrip.id, stopId });
  };

  // Render the header with action buttons
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{currentTrip?.name || 'Trip Itinerary'}</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.shareButton]} 
          onPress={shareItinerary}
          accessible={true}
          accessibilityLabel="Share itinerary"
        >
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.calendarButton]} 
          onPress={showExportOptions}
          accessible={true}
          accessibilityLabel="Export to calendar"
        >
          <Text style={styles.actionButtonText}>Export to Calendar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Update the renderMap function to include an expand/collapse button
  const renderMap = () => {
    if (mapError || !currentTrip?.stops || currentTrip.stops.length === 0) {
      return null;
    }
    
    try {
      // Prepare coordinates for each stop
      const stopCoordinates = currentTrip.stops
        .sort((a, b) => a.stop_order - b.stop_order)
        .map((stop: TripStop, index: number) => {
          // Try to extract coordinates from location property or notes
          let latitude, longitude;
          
          if (stop.location) {
            latitude = stop.location.latitude;
            longitude = stop.location.longitude;
          } else if (stop.notes) {
            // Try to extract coordinates from notes
            const coordinateMatch = stop.notes.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
            if (coordinateMatch && coordinateMatch.length >= 3) {
              latitude = parseFloat(coordinateMatch[1]);
              longitude = parseFloat(coordinateMatch[2]);
            }
          }
          
          if (latitude && longitude) {
            console.log(`Found coordinates for stop ${index + 1}: ${latitude}, ${longitude}`);
            return { 
              latitude, 
              longitude,
              stopId: stop.id,
              stopOrder: stop.stop_order,
              resort: stop.resort,
              index: index // Keep track of the index for determining marker color
            };
          }
          console.log(`No coordinates found for stop ${index + 1}`);
          return null;
        })
        .filter(coord => coord !== null);
      
      console.log(`Total stops with coordinates: ${stopCoordinates.length}`);
      
      if (stopCoordinates.length < 2) {
        return null; // Need at least 2 points for a route line
      }
      
      return (
        <View style={[styles.mapContainer, isMapExpanded && styles.expandedMapContainer]}>
          {isLoadingRoute && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color="#2E7D32" />
            </View>
          )}
          <MapView
            style={styles.map}
            region={mapRegion}
            provider={Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
            zoomEnabled={true}
            rotateEnabled={true}
            scrollEnabled={true}
            pitchEnabled={true}
          >
            {/* Display route line using fetched coordinate data if available */}
            {routeCoordinates.length > 0 ? (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#2E7D32" // Forest Green from your color palette
                strokeWidth={3}
              />
            ) : (
              <Polyline
                coordinates={stopCoordinates.map(coord => ({latitude: coord.latitude, longitude: coord.longitude}))}
                strokeColor="#2E7D32" // Forest Green from your color palette
                strokeWidth={3}
              />
            )}
            
            {/* Add markers for each stop - Map each stop coordinate to a marker */}
            {stopCoordinates.map((coord) => {
              // Log each marker being created
              console.log(`Creating marker for stop ${coord.index + 1} at ${coord.latitude}, ${coord.longitude}`);
              
              return (
                <Marker
                  key={`marker-${coord.stopId || coord.index}`}
                  coordinate={{
                    latitude: coord.latitude,
                    longitude: coord.longitude
                  }}
                  title={coord.resort?.name || `Stop ${coord.index + 1}`}
                  description={`Day ${coord.index + 1} of your trip`}
                  pinColor={
                    coord.index === 0 ? 'green' : 
                    coord.index === stopCoordinates.length - 1 ? 'red' : 
                    'blue'
                  }
                  onPress={() => {
                    // Show a callout first
                    // Then if user taps on the callout/info window, navigate to resort selection
                    if (coord.stopId) {
                      console.log(`Marker pressed for stop ${coord.index + 1}`);
                    }
                  }}
                  onCalloutPress={() => {
                    if (coord.stopId) {
                      console.log(`Callout pressed for stop ${coord.index + 1}`);
                      navigateToResortDetails(coord.stopId);
                    }
                  }}
                />
              );
            })}
          </MapView>
          
          {/* Add expand/collapse button */}
          <TouchableOpacity 
            style={styles.mapExpandButton} 
            onPress={() => setIsMapExpanded(!isMapExpanded)}
            accessible={true}
            accessibilityLabel={isMapExpanded ? "Collapse map" : "Expand map"}
          >
            <Text style={styles.mapExpandButtonText}>
              {isMapExpanded ? "Collapse Map" : "Expand Map"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    } catch (err) {
      console.error('Error rendering map:', err);
      setMapError(true);
      return null;
    }
  };

  // Render a stop item
  const renderStopItem = ({ item, index }: { item: TripStop; index: number }) => {
    const checkInDate = new Date(item.check_in);
    const checkOutDate = new Date(item.check_out);
    const resort = item.resort || { name: 'Select a Resort', address: 'Tap to choose a resort' };
    
    // Safely check if phone exists on resort
    const resortHasPhone = resort && 'phone' in resort && resort.phone;
    
    return (
      <View style={styles.stopItem}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayNumber}>{index + 1}</Text>
        </View>
        
        <View style={styles.stopDetails}>
          <TouchableOpacity 
            style={styles.resortSelector}
            onPress={() => navigateToResortDetails(item.id)}
            accessible={true}
            accessibilityLabel={`Select resort for day ${index + 1}`}
          >
            <Text style={styles.resortName}>{resort.name}</Text>
            <Text style={styles.location}>{resort.address}</Text>
            {!item.resort_id && (
              <Text style={styles.selectResortPrompt}>Tap to select a resort</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.checkTimes}>
            <Text style={styles.checkTimeLabel}>
              Check-in: {format(checkInDate, 'MMM d, h:mm a')}
            </Text>
            <Text style={styles.checkTimeLabel}>
              Check-out: {format(checkOutDate, 'MMM d, h:mm a')}
            </Text>
          </View>
          
          {item.booking_info?.site_number && (
            <Text style={styles.siteNumber}>Site #: {item.booking_info.site_number}</Text>
          )}
          
          {resortHasPhone && (
            <Text style={styles.phoneNumber}>Phone: {resort.phone}</Text>
          )}
          
          <View style={styles.notesContainer}>
            {editingNotes === item.id ? (
              <View style={styles.notesEditContainer}>
                <TextInput
                  style={styles.notesInput}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Add notes about this stop..."
                  multiline
                  accessible={true}
                  accessibilityLabel="Edit notes for this stop"
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => saveNotes(item.id)}
                  accessible={true}
                  accessibilityLabel="Save notes"
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.notesDisplay}
                onPress={() => startEditingNotes(item.id, item.notes)}
                accessible={true}
                accessibilityLabel={item.notes ? "Edit notes" : "Add notes for this stop"}
              >
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>
                  {item.notes || 'Tap to add notes...'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.reorderButtons}>
            {index > 0 && (
              <TouchableOpacity
                style={[styles.reorderButton, styles.moveUpButton]}
                onPress={() => moveStop(index, index - 1)}
                accessible={true}
                accessibilityLabel={`Move day ${index + 1} up in itinerary`}
              >
                <Text style={styles.reorderButtonText}>↑</Text>
              </TouchableOpacity>
            )}
            {index < (currentTrip?.stops?.length || 0) - 1 && (
              <TouchableOpacity
                style={[styles.reorderButton, styles.moveDownButton]}
                onPress={() => moveStop(index, index + 1)}
                accessible={true}
                accessibilityLabel={`Move day ${index + 1} down in itinerary`}
              >
                <Text style={styles.reorderButtonText}>↓</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading your itinerary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading itinerary: {error.message}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => getTrip(tripId)}
            accessible={true}
            accessibilityLabel="Retry loading trip"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Empty stops state
  const tripWithStops = currentTrip as (Trip & { trip_stops?: TripStop[] }) | null;
  if (!currentTrip?.stops && !tripWithStops?.trip_stops || 
      (currentTrip?.stops?.length === 0 && (!tripWithStops?.trip_stops || tripWithStops?.trip_stops?.length === 0))) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stops found in this itinerary.</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('RoutePlanner')}
            accessible={true}
            accessibilityLabel="Plan a new route"
          >
            <Text style={styles.actionButtonText}>Plan a New Route</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use trip_stops if stops is empty
  const displayStops = currentTrip?.stops?.length ? currentTrip.stops : 
    (tripWithStops?.trip_stops || []);

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {/* Add the map view here */}
      {renderMap()}
      
      {/* Only show the list if map is not expanded */}
      {!isMapExpanded && (
        <>
          {isLoading ? (
            <ActivityIndicator size="large" color="#2E7D32" style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : !currentTrip ? (
            <Text style={styles.errorText}>Trip not found</Text>
          ) : !currentTrip.stops || currentTrip.stops.length === 0 ? (
            <Text style={styles.noStopsText}>No stops in this trip yet. Add some in the route planner.</Text>
          ) : (
            <FlatList
              data={currentTrip.stops.sort((a, b) => a.stop_order - b.stop_order)}
              renderItem={renderStopItem}
              keyExtractor={(item) => item.id}
              style={styles.stopsList}
              contentContainerStyle={styles.stopsListContent}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  header: {
    padding: 16,
    backgroundColor: '#2E7D32',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#FF7043',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#42A5F5',
  },
  calendarButton: {
    backgroundColor: '#FF7043',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  stopItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dayBadge: {
    width: 40,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopDetails: {
    flex: 1,
    padding: 12,
  },
  resortSelector: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resortName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  selectResortPrompt: {
    fontSize: 14,
    color: '#2E7D32',
    fontStyle: 'italic',
  },
  checkTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  checkTimeLabel: {
    fontSize: 14,
    color: '#666',
  },
  siteNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notesContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  notesDisplay: {
    flexDirection: 'column',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  notesEditContainer: {
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 8,
    minHeight: 80,
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  reorderButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  reorderButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  moveUpButton: {
    backgroundColor: '#42A5F5',
  },
  moveDownButton: {
    backgroundColor: '#42A5F5',
  },
  reorderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#37474F',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 4,
    padding: 8,
    paddingHorizontal: 16,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  mapContainer: {
    width: '100%',
    height: 200,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative', // for absolute positioning of the expand button
  },
  expandedMapContainer: {
    height: Dimensions.get('window').height - 150, // Full height minus header space
    marginBottom: 0,
    borderRadius: 0,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loader: {
    marginTop: 16,
  },
  noStopsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  stopsList: {
    padding: 16,
  },
  stopsListContent: {
    padding: 16,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapExpandButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(46, 125, 50, 0.9)', // Increase opacity
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 5, // Increase elevation for Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, // Increase shadow opacity
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'white',
    zIndex: 999, // Ensure it appears above other elements
  },
  mapExpandButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16, // Larger text
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default ItineraryScreen; 