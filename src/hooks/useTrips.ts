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
        const { data, error } = await SupabaseService.getUserTrips(user.id);

        if (error) {
          throw error;
        }

        if (data) {
          // Cache trips for offline use
          await OfflineService.cacheTrips(data);
          
          setState(prev => ({
            ...prev,
            trips: data,
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

      // Check if we already have this trip in state
      const existingTrip = state.trips.find(t => t.id === tripId);
      if (existingTrip && existingTrip.stops) {
        setState(prev => ({
          ...prev,
          currentTrip: existingTrip,
          isLoading: false
        }));
        return existingTrip;
      }

      // Try offline cache first
      const cachedTrip = await OfflineService.getCachedTrip(tripId);
      if (cachedTrip) {
        setState(prev => ({
          ...prev,
          currentTrip: cachedTrip,
          isLoading: false
        }));
        return cachedTrip;
      }

      // If online and not guest, fetch from Supabase
      if (isConnected && !isGuest) {
        const { data, error } = await SupabaseService.getTripById(tripId);

        if (error) {
          throw error;
        }

        if (data) {
          // Cache trip for offline use
          await OfflineService.cacheTrip(data);
          
          setState(prev => ({
            ...prev,
            currentTrip: data,
            isLoading: false
          }));
          return data;
        }
      }

      throw new Error('Trip not found');
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
      return null;
    }
  };

  // Create a new trip
  const createTrip = async (tripData: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (isGuest) {
        // For guest users, we only store locally
        const now = new Date().toISOString();
        const newTrip: Trip = {
          ...tripData,
          id: `local-${Date.now()}`,
          user_id: user.id,
          created_at: now,
          updated_at: now,
          stops: []
        };

        // Save to offline storage
        await OfflineService.cacheTrip(newTrip);

        // Update state
        setState(prev => ({
          ...prev,
          trips: [...prev.trips, newTrip],
          currentTrip: newTrip,
          isLoading: false
        }));

        return { success: true, trip: newTrip };
      } else if (isConnected) {
        // For registered users, save to Supabase
        console.log('Creating trip in Supabase:', JSON.stringify({
          ...tripData,
          user_id: user.id
        }, null, 2));
        
        // Use a properly formatted UUID for testing purposes if we're using the test ID
        const userId = user.id === 'test-user-id-123' 
          ? '00000000-0000-4000-8000-000000000000' // Standard test UUID that follows proper format
          : user.id;
        
        const { trip, error } = await SupabaseService.createTrip({
          ...tripData,
          user_id: userId
        });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        if (trip) {
          // Cache for offline use
          await OfflineService.cacheTrip(trip);

          // Update state
          setState(prev => ({
            ...prev,
            trips: [...prev.trips, trip],
            currentTrip: trip,
            isLoading: false
          }));

          return { success: true, trip };
        }
        
        throw new Error('Failed to create trip in Supabase');
      } else {
        // Offline but registered - store locally and sync later
        const now = new Date().toISOString();
        const newTrip: Trip = {
          ...tripData,
          id: `offline-${Date.now()}`,
          user_id: user.id,
          created_at: now,
          updated_at: now,
          stops: []
        };

        // Mark for sync when online
        await OfflineService.queueForSync('trip', newTrip);

        // Save to offline storage
        await OfflineService.cacheTrip(newTrip);

        // Update state
        setState(prev => ({
          ...prev,
          trips: [...prev.trips, newTrip],
          currentTrip: newTrip,
          isLoading: false
        }));

        return { success: true, trip: newTrip };
      }
    } catch (err) {
      console.error('Error in createTrip:', err);
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