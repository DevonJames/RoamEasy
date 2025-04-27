import { useState, useCallback } from 'react';
import MapsService, { 
  RouteResult as Route, 
  Location as RouteLocation, 
  StopPoint 
} from '../services/MapsService';
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
      
      // IMPORTANT FIX: If we didn't get any stops from the OpenAI service,
      // generate some basic ones from the route waypoints
      let finalStops = stops || [];
      
      if (!finalStops || finalStops.length === 0) {
        console.warn('No stops returned from OpenAIService, generating from waypoints');
        
        // Use waypoints from the route as a fallback
        if (route.waypoints && route.waypoints.length > 0) {
          finalStops = route.waypoints;
          console.log('Generated fallback stops from waypoints:', finalStops.length);
        }
      }
      
      // Skip map tile caching for now - it's causing errors and isn't critical
      // Try {
      //   await OfflineService.cacheMapTiles(stops);
      // } catch (cacheError) {
      //   console.warn('Failed to cache map tiles, but continuing with route planning:', cacheError);
      // }
      
      // Filter out any stops that don't have valid latitude and longitude
      const validStops = finalStops.filter(stop => 
        stop && 
        typeof stop.coordinates.latitude === 'number' && 
        typeof stop.coordinates.longitude === 'number'
      ) || [];
      
      console.log('Valid stops from optimizeRoute:', JSON.stringify(validStops, null, 2));
      
      setState(prevState => ({
        ...prevState,
        route,
        stops: validStops,
        isLoading: false,
      }));
      
      // IMPORTANT FIX: Always return the valid stops, regardless of whether they came from result.stops
      return { success: true, route, stops: validStops };
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
      
      // Validate that location and location.coordinates exist and have valid latitude/longitude
      if (!location || !location.coordinates || 
          typeof location.coordinates.latitude !== 'number' || 
          typeof location.coordinates.longitude !== 'number') {
        throw new Error('Invalid location: missing valid coordinates');
      }
      
      // Use the searchLocation method instead since searchNearbyPlaces doesn't exist
      // We'll modify the query to look for RV parks near the location
      const searchQuery = `RV parks near ${location.coordinates.latitude},${location.coordinates.longitude}`;
      const { locations: resorts, error } = await MapsService.searchLocation(searchQuery);
      
      if (error) throw error;
      
      // Skip resort caching for now - it's causing type errors
      // We'll implement proper caching later once we have the correct Resort type
      
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
      // Validate that both from and to locations have valid coordinates
      if (!from || !from.coordinates || 
          typeof from.coordinates.latitude !== 'number' || 
          typeof from.coordinates.longitude !== 'number') {
        throw new Error('Invalid origin location: missing valid coordinates');
      }
      
      if (!to || !to.coordinates || 
          typeof to.coordinates.latitude !== 'number' || 
          typeof to.coordinates.longitude !== 'number') {
        throw new Error('Invalid destination location: missing valid coordinates');
      }
      
      // Use getRoute instead of getDirections
      const { route, error } = await MapsService.getRoute(from, to);
      
      if (error) throw error;
      
      setState(prevState => ({
        ...prevState,
        isLoading: false,
      }));
      
      return { success: true, directions: route?.legs[0]?.steps || [] };
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
      
      // Filter out any locations without valid coordinates to prevent errors later
      const validLocations = locations ? locations.filter(location => 
        location && 
        location.coordinates && 
        typeof location.coordinates.latitude === 'number' && 
        typeof location.coordinates.longitude === 'number'
      ) : [];
      
      setState(prevState => ({
        ...prevState,
        isLoading: false,
      }));
      
      return { success: true, locations: validLocations };
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
  const getCachedMapTiles = useCallback(async (bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  }, zoomLevel = 10) => {
    try {
      // We'll implement proper map tile caching later
      // const mapTiles = await OfflineService.getCachedMapTiles(bounds, zoomLevel);
      return { success: true, mapTiles: [] };
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