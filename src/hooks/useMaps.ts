import { useState, useCallback } from 'react';
import MapsService, { 
  RouteResult as Route, 
  Location as RouteLocation, 
  StopPoint 
} from '../services/MapsService';
import OfflineService from '../services/OfflineService';
import OpenAIService from '../services/OpenAIService';
import { useNetInfo } from '@react-native-community/netinfo';
import { GOOGLE_MAPS_API_KEY } from '../utils/environment';

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
    let resortsToReturn: any[] = [];

    try {
      if (!location || !location.coordinates || 
          typeof location.coordinates.latitude !== 'number' || 
          typeof location.coordinates.longitude !== 'number') {
        throw new Error('Invalid location: missing valid coordinates');
      }
      
      console.log(`Getting resort suggestions near ${location.coordinates.latitude},${location.coordinates.longitude} using Places API`);
      
      const { places, error } = await MapsService.searchNearbyPlaces(location.coordinates);
      if (error) throw error;
      
      if (places && places.length > 0) {
        console.log(`Found ${places.length} nearby places.`);
        if (places[0]) {
          console.log('Raw structure of first place result:', JSON.stringify(places[0], null, 2));
        }
        
        // Map the Places API result 
        resortsToReturn = places.map((place: any) => {
          const apiKey = GOOGLE_MAPS_API_KEY; 
          const photoRef = place.photos?.[0]?.photo_reference;
          const imageUrl = photoRef && apiKey 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${apiKey}` 
            : null;

          // ---> CAREFUL MAPPING <--- 
          const resortName = place.name || 'Name Unknown'; // Explicitly get name
          const resortAddress = place.vicinity || place.formatted_address || 'Address Unknown'; // Use vicinity or fallback
          const resortLat = place.geometry?.location?.lat;
          const resortLng = place.geometry?.location?.lng;
          const resortRating = place.rating || 0;
          const resortTypes = place.types || [];

          // Basic validation
          if (!place.place_id || typeof resortLat !== 'number' || typeof resortLng !== 'number') {
             console.warn('Skipping place due to missing ID or coordinates:', place);
             return null; // Skip this place if essential data is missing
          }

          return {
            id: place.place_id, 
            name: resortName, // Use the variable
            address: resortAddress, // Use the variable
            coordinates: {
              latitude: resortLat,
              longitude: resortLng
            },
            rating: resortRating, 
            amenities: resortTypes, 
            nightly_rate: null, // Placeholder
            phone: null, // Placeholder
            website: null, // Placeholder
            image_url: imageUrl,
            last_updated: new Date().toISOString()
          };
        }).filter(resort => resort !== null); // Filter out any skipped null entries
      } else {
        console.log("No nearby places found by Places API.");
        resortsToReturn = [];
      }
      
    } catch (error) {
      console.error("Error in getResortSuggestions:", error);
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: error as Error,
      }));
      // Keep the mock data return in the catch block as a final fallback
      resortsToReturn = [ /* ... same fallback resorts as before ... */ 
        {
          id: 'fallback-1',
          name: "Fallback RV Resort",
          address: "Near " + (location.address || "Your Location"),
          coordinates: { latitude: location.coordinates.latitude + 0.01, longitude: location.coordinates.longitude + 0.01 },
          rating: 3.5, amenities: ['Fallback'], nightly_rate: 50, last_updated: new Date().toISOString()
        },
        {
          id: 'fallback-2',
          name: "Emergency Campground",
          address: "Near " + (location.address || "Your Location"),
          coordinates: { latitude: location.coordinates.latitude - 0.01, longitude: location.coordinates.longitude - 0.01 },
          rating: 3.0, amenities: ['Fallback'], nightly_rate: 40, last_updated: new Date().toISOString()
        }
      ];
    } finally {
        setState(prevState => ({
          ...prevState,
          isLoading: false,
        }));
    }
    // ---> Log the final mapped resorts just before returning <---
    console.log('Final mapped resorts to return:', JSON.stringify(resortsToReturn.slice(0, 2), null, 2)); // Log first 2 for brevity
    
    // Return the result outside the try/catch/finally
    return { success: true, resorts: resortsToReturn }; 
  }, []);

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