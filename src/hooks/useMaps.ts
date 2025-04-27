import { useState, useCallback } from 'react';
import MapsService, { Route, RouteLocation } from '../services/MapsService';
import OfflineService from '../services/OfflineService';
import OpenAIService from '../services/OpenAIService';
import { useNetInfo } from '@react-native-community/netinfo';

export interface MapsState {
  route: Route | null;
  stops: RouteLocation[];
  isLoading: boolean;
  error: Error | null;
}

export interface RouteParams {
  startLocation: RouteLocation;
  endLocation: RouteLocation;
  maxDriveTimeHours: number;
  sceneryPreferences: {
    coast?: boolean;
    mountains?: boolean;
    forest?: boolean;
    river?: boolean;
  };
}

export default function useMaps() {
  const [state, setState] = useState<MapsState>({
    route: null,
    stops: [],
    isLoading: false,
    error: null,
  });
  
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected;

  // Plan a route with stops
  const planRoute = useCallback(async (params: RouteParams) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null }));
    
    try {
      if (!isConnected) {
        throw new Error('Internet connection required for route planning');
      }
      
      // Get a route from Maps API
      const { route, error } = await MapsService.getRoute(
        params.startLocation, 
        params.endLocation
      );
      
      if (error) throw error;
      if (!route) throw new Error('Failed to get route');
      
      // Use OpenAI to optimize route with stops based on driving time and preferences
      const { stops, error: stopsError } = await OpenAIService.optimizeRoute({
        route,
        maxDriveTimeHours: params.maxDriveTimeHours,
        sceneryPreferences: params.sceneryPreferences
      });
      
      if (stopsError) throw stopsError;
      
      // Cache route and stops for offline use
      await OfflineService.cacheMapTiles(stops);
      
      setState(prevState => ({
        ...prevState,
        route,
        stops,
        isLoading: false,
      }));
      
      return { success: true, route, stops };
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: error as Error,
      }));
      
      return { success: false, error: error as Error };
    }
  }, [isConnected]);

  // Get resort suggestions near a stop
  const getResortSuggestions = useCallback(async (location: RouteLocation, preferences: any) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null }));
    
    try {
      if (!isConnected) {
        throw new Error('Internet connection required for resort suggestions');
      }
      
      const { resorts, error } = await MapsService.findNearbyResorts(location, preferences);
      
      if (error) throw error;
      
      // Cache resort data for offline
      if (resorts && resorts.length > 0) {
        await OfflineService.cacheResortData(resorts);
      }
      
      setState(prevState => ({
        ...prevState,
        isLoading: false,
      }));
      
      return { success: true, resorts };
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: error as Error,
      }));
      
      return { success: false, error: error as Error };
    }
  }, [isConnected]);

  // Get directions between two points
  const getDirections = useCallback(async (from: RouteLocation, to: RouteLocation) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null }));
    
    try {
      const { directions, error } = await MapsService.getDirections(from, to);
      
      if (error) throw error;
      
      setState(prevState => ({
        ...prevState,
        isLoading: false,
      }));
      
      return { success: true, directions };
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: error as Error,
      }));
      
      return { success: false, error: error as Error };
    }
  }, []);

  // Search for a location by string
  const searchLocation = useCallback(async (query: string) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null }));
    
    try {
      if (!isConnected) {
        throw new Error('Internet connection required for location search');
      }
      
      const { locations, error } = await MapsService.searchLocation(query);
      
      if (error) throw error;
      
      setState(prevState => ({
        ...prevState,
        isLoading: false,
      }));
      
      return { success: true, locations };
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: error as Error,
      }));
      
      return { success: false, error: error as Error };
    }
  }, [isConnected]);

  // Get offline cached map tiles
  const getCachedMapTiles = useCallback(async (stopIds: string[]) => {
    try {
      const mapTiles = await OfflineService.getCachedMapTiles(stopIds);
      return { success: true, mapTiles };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }, []);

  return {
    ...state,
    planRoute,
    getResortSuggestions,
    getDirections,
    searchLocation,
    getCachedMapTiles,
    isOnline: !!isConnected,
  };
} 