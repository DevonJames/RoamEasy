import { useState, useCallback } from 'react';
import OfflineService from '../services/OfflineService';
import { Trip } from '../types/trip';
import { Resort } from '../types/resort';

interface MapTile {
  id: string;
  zoom: number;
  x: number;
  y: number;
  data: string;
}

export function useOfflineCache() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Cache trip data for offline access
  const cacheTrip = useCallback(async (trip: Trip): Promise<{ success: boolean, error?: Error }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await OfflineService.cacheTrip(trip);
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Cache resort data for a trip's stops
  const cacheResorts = useCallback(async (resorts: Resort[]): Promise<{ success: boolean, error?: Error }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await OfflineService.cacheResorts(resorts);
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Cache map tiles for a trip's route
  const cacheMapTiles = useCallback(async (
    bounds: { 
      northeast: { lat: number, lng: number }, 
      southwest: { lat: number, lng: number } 
    },
    zoomLevels: number[] = [10, 12, 14]
  ): Promise<{ success: boolean, count?: number, error?: Error }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const count = await OfflineService.cacheMapTiles(bounds, zoomLevels);
      setIsLoading(false);
      return { success: true, count };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Get all cached trips
  const getCachedTrips = useCallback(async (): Promise<{ 
    success: boolean, 
    trips?: Trip[], 
    error?: Error 
  }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const trips = await OfflineService.getCachedTrips();
      setIsLoading(false);
      return { success: true, trips };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Get a specific cached trip
  const getCachedTrip = useCallback(async (tripId: string): Promise<{ 
    success: boolean, 
    trip?: Trip, 
    error?: Error 
  }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const trip = await OfflineService.getCachedTrip(tripId);
      setIsLoading(false);
      
      if (!trip) {
        return { 
          success: false, 
          error: new Error(`Trip with ID ${tripId} not found in cache`) 
        };
      }
      
      return { success: true, trip };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Get resorts for a specific trip
  const getCachedResorts = useCallback(async (tripId: string): Promise<{ 
    success: boolean, 
    resorts?: Resort[], 
    error?: Error 
  }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const resorts = await OfflineService.getCachedResorts(tripId);
      setIsLoading(false);
      return { success: true, resorts };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Get cached map tiles for a region
  const getCachedMapTiles = useCallback(async (
    bounds: { 
      northeast: { lat: number, lng: number }, 
      southwest: { lat: number, lng: number } 
    },
    zoom: number
  ): Promise<{ 
    success: boolean, 
    tiles?: MapTile[], 
    error?: Error 
  }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tiles = await OfflineService.getCachedMapTiles(bounds, zoom);
      setIsLoading(false);
      return { success: true, tiles };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Clear cache for a specific trip
  const clearTripCache = useCallback(async (tripId: string): Promise<{ 
    success: boolean, 
    error?: Error 
  }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await OfflineService.clearTripCache(tripId);
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Check if a trip is fully cached
  const isTripCached = useCallback(async (tripId: string): Promise<{
    success: boolean,
    isCached?: boolean,
    error?: Error
  }> => {
    try {
      const isCached = await OfflineService.isTripCached(tripId);
      return { success: true, isCached };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  }, []);

  // Get the total size of the cache in bytes
  const getCacheSize = useCallback(async (): Promise<{
    success: boolean,
    sizeInBytes?: number,
    error?: Error
  }> => {
    try {
      const sizeInBytes = await OfflineService.getCacheSize();
      return { success: true, sizeInBytes };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  }, []);

  return {
    isLoading,
    error,
    cacheTrip,
    cacheResorts,
    cacheMapTiles,
    getCachedTrips,
    getCachedTrip,
    getCachedResorts,
    getCachedMapTiles,
    clearTripCache,
    isTripCached,
    getCacheSize,
  };
}

export default useOfflineCache; 