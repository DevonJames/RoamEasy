import { useState, useEffect, useCallback } from 'react';
import SupabaseService from '../services/SupabaseService';
import OfflineService from '../services/OfflineService';
import CalendarService from '../services/CalendarService';
import NotificationService from '../services/NotificationService';
import { useNetInfo } from '@react-native-community/netinfo';
import useAuth from './useAuth';

export interface Resort {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  amenities: string[];
  phone?: string;
  website?: string;
  nightly_rate?: number;
  image_url?: string;
  last_updated: string;
}

export interface TripStop {
  id: string;
  trip_id: string;
  resort_id: string;
  resort?: Resort;
  stop_order: number;
  check_in: string; // ISO date string
  check_out: string; // ISO date string
  notes?: string;
  booking_info?: {
    confirmation_number?: string;
    site_number?: string;
    special_instructions?: string;
  };
}

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  end_location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  stops?: TripStop[];
  trip_stops?: TripStop[]; // For Supabase nested query results
}

interface TripsState {
  trips: Trip[];
  currentTrip: Trip | null;
  isLoading: boolean;
  error: Error | null;
}

export default function useTrips() {
  const [state, setState] = useState<TripsState>({
    trips: [],
    currentTrip: null,
    isLoading: false,
    error: null
  });

  const netInfo = useNetInfo();
  const isConnected = !!netInfo.isConnected;
  const { user, isGuest } = useAuth();

  // Load trips on mount and when user changes
  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  // Load all trips for the current user
  const loadTrips = async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Try to load from offline storage first
      const cachedTrips = await OfflineService.getCachedTrips(user.id);
      
      if (cachedTrips && cachedTrips.length > 0) {
        setState(prev => ({
          ...prev,
          trips: cachedTrips,
          isLoading: false
        }));
      }

      // If online and not guest, fetch from Supabase
      if (isConnected && !isGuest) {
        const { trips, error } = await SupabaseService.getTrips(user.id);

        if (error) {
          throw error;
        }

        if (trips) {
          // Cache trips for offline use
          for (const trip of trips) {
            await OfflineService.cacheTrip(trip);
          }
          
          setState(prev => ({
            ...prev,
            trips: trips,
            isLoading: false
          }));
        }
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
    }
  };

  // Get a single trip by ID
  const getTrip = async (tripId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('Getting trip:', tripId);
      const trip = await SupabaseService.getTrip(tripId);
      
      if (!trip) {
        setState(prev => ({
          ...prev,
          error: new Error('Trip not found'),
          isLoading: false
        }));
        return null;
      }
      
      console.log(`Retrieved trip ${tripId} with ${trip.stops?.length || 0} stops`);
      setState(prev => ({
        ...prev,
        currentTrip: trip,
        isLoading: false
      }));
      return trip;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get trip';
      console.error('Error in getTrip:', errorMessage);
      setState(prev => ({
        ...prev,
        error: new Error(errorMessage),
        isLoading: false
      }));
      return null;
    }
  };

  // Create a new trip
  const createTrip = async (tripDataWithId: Trip) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Determine if it's a guest or registered user based on the provided user_id
      // Assuming guest ID is '00000000-0000-4000-8000-000000000000' or similar check if needed,
      // OR simply rely on SupabaseService.createTrip to handle auth based on the session associated with the request.
      // For now, let's assume SupabaseService handles it correctly based on the implicit session.

      // We'll simplify and assume we only call SupabaseService if online
      if (isConnected) {
        // Registered user, online OR Guest user online (if anon auth enabled)
        console.log('Creating trip in Supabase with provided data:', JSON.stringify(tripDataWithId, null, 2));
        
        const { trip, error } = await SupabaseService.createTrip(tripDataWithId);

        if (error) {
          console.error('Supabase error during trip creation:', error);
          // Check if the error is specifically an auth error
          if (error.message.includes('authent') || error.message.includes('JWT')) {
             throw new Error('User authentication failed during trip creation. Please sign out and back in.');
          } else {
            throw error; // Re-throw other errors
          }
        }

        if (trip) {
          await OfflineService.cacheTrip(trip); // Cache after successful creation
          setState(prev => ({
            ...prev,
            trips: [...prev.trips, trip],
            currentTrip: trip,
            isLoading: false
          }));
          return { success: true, trip };
        }
        
        throw new Error('Failed to create trip in Supabase, no trip data returned.');

      } else {
        // Offline logic (applies to both guests and registered users when offline)
        console.log('Offline: Creating trip locally.');
        const now = new Date().toISOString();
        const offlineTripId = `offline-${Date.now()}`;
        const newTrip: Trip = {
          ...tripDataWithId,
          id: offlineTripId,
          created_at: now,
          updated_at: now,
          stops: []
        };
        // If it's a registered user offline, queue for sync
        if (tripDataWithId.user_id !== '00000000-0000-4000-8000-000000000000') { // Example guest check
           await OfflineService.queueForSync('trip', newTrip);
        }
        await OfflineService.cacheTrip(newTrip);
        setState(prev => ({
          ...prev,
          trips: [...prev.trips, newTrip],
          currentTrip: newTrip,
          isLoading: false
        }));
        return { success: true, trip: newTrip };
      }
    } catch (err) {
      console.error('Error in useTrips.createTrip:', err);
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Update an existing trip
  const updateTrip = async (tripId: string, updates: Partial<Trip>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Find the trip in state
      const existingTrip = state.trips.find(t => t.id === tripId);
      if (!existingTrip) {
        throw new Error('Trip not found');
      }

      const updatedTrip: Trip = {
        ...existingTrip,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Always update in offline storage
      await OfflineService.cacheTrip(updatedTrip);

      // Update state immediately
      setState(prev => ({
        ...prev,
        trips: prev.trips.map(t => t.id === tripId ? updatedTrip : t),
        currentTrip: prev.currentTrip?.id === tripId ? updatedTrip : prev.currentTrip
      }));

      // If online and not guest, update in Supabase
      if (isConnected && !isGuest) {
        const { data, error } = await SupabaseService.updateTrip(tripId, updates);

        if (error) {
          throw error;
        }

        if (data) {
          // Update with Supabase data
          await OfflineService.cacheTrip(data);
          
          setState(prev => ({
            ...prev,
            trips: prev.trips.map(t => t.id === tripId ? data : t),
            currentTrip: prev.currentTrip?.id === tripId ? data : prev.currentTrip,
            isLoading: false
          }));
          
          return { success: true, trip: data };
        }
      } else if (!isGuest) {
        // Offline but registered - queue for sync
        await OfflineService.queueForSync('trip', updatedTrip);
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true, trip: updatedTrip };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Delete a trip
  const deleteTrip = async (tripId: string) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Remove from offline storage
      await OfflineService.removeTrip(tripId);

      // Update state immediately
      setState(prev => ({
        ...prev,
        trips: prev.trips.filter(t => t.id !== tripId),
        currentTrip: prev.currentTrip?.id === tripId ? null : prev.currentTrip
      }));

      // If online and not guest, delete from Supabase
      if (isConnected && !isGuest) {
        const { error } = await SupabaseService.deleteTrip(tripId);

        if (error) {
          throw error;
        }
      } else if (!isGuest) {
        // Offline but registered - queue delete for sync
        await OfflineService.queueForSync('delete', { entity: 'trip', id: tripId });
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Add a stop to a trip
  const addTripStop = async (tripId: string, stopData: Omit<TripStop, 'id' | 'trip_id'>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Find the trip
      const existingTrip = state.trips.find(t => t.id === tripId);
      if (!existingTrip) {
        throw new Error('Trip not found');
      }

      // Create a new stop
      const newStop: TripStop = {
        ...stopData,
        id: `local-${Date.now()}`,
        trip_id: tripId
      };

      // Update the trip with the new stop
      const updatedTrip: Trip = {
        ...existingTrip,
        stops: [...(existingTrip.stops || []), newStop],
        updated_at: new Date().toISOString()
      };

      // Always update in offline storage
      await OfflineService.cacheTrip(updatedTrip);

      // Update state immediately
      setState(prev => ({
        ...prev,
        trips: prev.trips.map(t => t.id === tripId ? updatedTrip : t),
        currentTrip: prev.currentTrip?.id === tripId ? updatedTrip : prev.currentTrip
      }));

      // If online and not guest, add stop in Supabase
      if (isConnected && !isGuest) {
        const { data, error } = await SupabaseService.addTripStop(tripId, stopData);

        if (error) {
          throw error;
        }

        if (data) {
          // Get the updated trip with the new stop
          const { data: updatedTripData, error: tripError } = await SupabaseService.getTripById(tripId);

          if (tripError) {
            throw tripError;
          }

          if (updatedTripData) {
            // Update with Supabase data
            await OfflineService.cacheTrip(updatedTripData);
            
            setState(prev => ({
              ...prev,
              trips: prev.trips.map(t => t.id === tripId ? updatedTripData : t),
              currentTrip: prev.currentTrip?.id === tripId ? updatedTripData : prev.currentTrip,
              isLoading: false
            }));
            
            return { success: true, stop: data };
          }
        }
      } else if (!isGuest) {
        // Offline but registered - queue for sync
        await OfflineService.queueForSync('stop', newStop);
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true, stop: newStop };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Update a trip stop
  const updateTripStop = async (tripId: string, stopId: string, updates: Partial<TripStop>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Find the trip
      const existingTrip = state.trips.find(t => t.id === tripId);
      if (!existingTrip || !existingTrip.stops) {
        throw new Error('Trip or stops not found');
      }

      // Find the stop
      const existingStop = existingTrip.stops.find(s => s.id === stopId);
      if (!existingStop) {
        throw new Error('Stop not found');
      }

      // Update the stop
      const updatedStop: TripStop = {
        ...existingStop,
        ...updates
      };

      // Update the trip with the updated stop
      const updatedTrip: Trip = {
        ...existingTrip,
        stops: existingTrip.stops.map(s => s.id === stopId ? updatedStop : s),
        updated_at: new Date().toISOString()
      };

      // Always update in offline storage
      await OfflineService.cacheTrip(updatedTrip);

      // Update state immediately
      setState(prev => ({
        ...prev,
        trips: prev.trips.map(t => t.id === tripId ? updatedTrip : t),
        currentTrip: prev.currentTrip?.id === tripId ? updatedTrip : prev.currentTrip
      }));

      // If online and not guest, update stop in Supabase
      if (isConnected && !isGuest) {
        const { data, error } = await SupabaseService.updateTripStop(stopId, updates);

        if (error) {
          throw error;
        }

        if (data) {
          // Get the updated trip with the updated stop
          const updatedTripData = await SupabaseService.getTrip(tripId);
          const tripError = updatedTripData ? null : new Error('Failed to get updated trip data');

          if (tripError) {
            throw tripError;
          }

          if (updatedTripData) {
            // Update with Supabase data
            await OfflineService.cacheTrip(updatedTripData);
            
            setState(prev => ({
              ...prev,
              trips: prev.trips.map(t => t.id === tripId ? updatedTripData : t),
              currentTrip: prev.currentTrip?.id === tripId ? updatedTripData : prev.currentTrip,
              isLoading: false
            }));
            
            return { success: true, stop: data };
          }
        }
      } else if (!isGuest) {
        // Offline but registered - queue for sync
        await OfflineService.queueForSync('stop', updatedStop);
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true, stop: updatedStop };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Delete a trip stop
  const deleteTripStop = async (tripId: string, stopId: string) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Find the trip
      const existingTrip = state.trips.find(t => t.id === tripId);
      if (!existingTrip || !existingTrip.stops) {
        throw new Error('Trip or stops not found');
      }

      // Remove the stop
      const updatedTrip: Trip = {
        ...existingTrip,
        stops: existingTrip.stops.filter(s => s.id !== stopId),
        updated_at: new Date().toISOString()
      };

      // Always update in offline storage
      await OfflineService.cacheTrip(updatedTrip);

      // Update state immediately
      setState(prev => ({
        ...prev,
        trips: prev.trips.map(t => t.id === tripId ? updatedTrip : t),
        currentTrip: prev.currentTrip?.id === tripId ? updatedTrip : prev.currentTrip
      }));

      // If online and not guest, delete stop in Supabase
      if (isConnected && !isGuest) {
        const { error } = await SupabaseService.deleteTripStop(stopId);

        if (error) {
          throw error;
        }

        // Get the updated trip
        const updatedTripData = await SupabaseService.getTrip(tripId);
        const tripError = updatedTripData ? null : new Error('Failed to get updated trip data');

        if (tripError) {
          throw tripError;
        }

        if (updatedTripData) {
          // Update with Supabase data
          await OfflineService.cacheTrip(updatedTripData);
          
          setState(prev => ({
            ...prev,
            trips: prev.trips.map(t => t.id === tripId ? updatedTripData : t),
            currentTrip: prev.currentTrip?.id === tripId ? updatedTripData : prev.currentTrip,
            isLoading: false
          }));
        }
      } else if (!isGuest) {
        // Offline but registered - queue for sync
        await OfflineService.queueForSync('delete', { entity: 'stop', id: stopId });
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Reorder stops within a trip
  const reorderTripStops = async (tripId: string, newOrder: { id: string, stop_order: number }[]) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Find the trip
      const existingTrip = state.trips.find(t => t.id === tripId);
      if (!existingTrip || !existingTrip.stops) {
        throw new Error('Trip or stops not found');
      }

      // Create a map of stop IDs to their new order
      const orderMap = new Map(newOrder.map(item => [item.id, item.stop_order]));

      // Update each stop with its new order
      const updatedStops = existingTrip.stops.map(stop => {
        const newStopOrder = orderMap.get(stop.id);
        if (newStopOrder !== undefined) {
          return { ...stop, stop_order: newStopOrder };
        }
        return stop;
      });

      // Sort stops by their new order
      updatedStops.sort((a, b) => a.stop_order - b.stop_order);

      // Update the trip with reordered stops
      const updatedTrip: Trip = {
        ...existingTrip,
        stops: updatedStops,
        updated_at: new Date().toISOString()
      };

      // Always update in offline storage
      await OfflineService.cacheTrip(updatedTrip);

      // Update state immediately
      setState(prev => ({
        ...prev,
        trips: prev.trips.map(t => t.id === tripId ? updatedTrip : t),
        currentTrip: prev.currentTrip?.id === tripId ? updatedTrip : prev.currentTrip
      }));

      // If online and not guest, update stop order in Supabase
      if (isConnected && !isGuest) {
        const promises = newOrder.map(item => 
          SupabaseService.updateTripStop(item.id, { stop_order: item.stop_order })
        );
        
        const results = await Promise.allSettled(promises);
        const errors = results
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(result => result.reason);
        
        if (errors.length > 0) {
          console.error('Errors updating stop orders:', errors);
          // Continue anyway, we'll try to sync later
        }

        // Get the updated trip
        const { data: updatedTripData, error: tripError } = await SupabaseService.getTripById(tripId);

        if (tripError) {
          throw tripError;
        }

        if (updatedTripData) {
          // Update with Supabase data
          await OfflineService.cacheTrip(updatedTripData);
          
          setState(prev => ({
            ...prev,
            trips: prev.trips.map(t => t.id === tripId ? updatedTripData : t),
            currentTrip: prev.currentTrip?.id === tripId ? updatedTripData : prev.currentTrip,
            isLoading: false
          }));
        }
      } else if (!isGuest) {
        // Offline but registered - queue for sync
        await OfflineService.queueForSync('reorder', { 
          entity: 'trip_stops', 
          trip_id: tripId, 
          order: newOrder 
        });
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Export trip to calendar
  const exportTripToCalendar = async (tripId: string, calendarType: 'google' | 'icloud' | 'ical') => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Find the trip
      const trip = state.trips.find(t => t.id === tripId);
      if (!trip || !trip.stops || trip.stops.length === 0) {
        throw new Error('Trip or stops not found');
      }

      // Call calendar export service via Supabase
      if (isConnected) {
        const { data, error } = await SupabaseService.exportTripToCalendar(tripId, calendarType);

        if (error) {
          throw error;
        }

        setState(prev => ({ ...prev, isLoading: false }));
        return { success: true, data };
      } else {
        throw new Error('Calendar export requires an internet connection');
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  // Sync offline changes when connection is restored
  const syncOfflineChanges = async () => {
    if (!user || isGuest || !isConnected) return { success: false };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await OfflineService.processSyncQueue(SupabaseService);

      // Refresh trips from server
      await loadTrips();

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true, ...result };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return { success: false, error: err as Error };
    }
  };

  return {
    ...state,
    loadTrips,
    getTrip,
    createTrip,
    updateTrip,
    deleteTrip,
    addTripStop,
    updateTripStop,
    deleteTripStop,
    reorderTripStops,
    exportTripToCalendar,
    syncOfflineChanges,
    isOnline: isConnected
  };
} 