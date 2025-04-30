import axios from 'axios';
import { Platform } from 'react-native';
import { GOOGLE_MAPS_API_KEY, OPENROUTE_SERVICE_API_KEY } from '../utils/environment';
import OfflineService from './OfflineService';
import { Buffer } from 'buffer';
import MapsOfflineCache from './MapsOfflineCache';

// Configuration constants
const ORS_API_KEY = OPENROUTE_SERVICE_API_KEY;

// Endpoints
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  coordinates: Coordinates;
  address: string;
  placeId?: string;
}

export interface RouteStep {
  distance: number; // in meters
  duration: number; // in seconds
  instructions: string;
  maneuver?: string;
  startLocation: Coordinates;
  endLocation: Coordinates;
}

export interface RouteLeg {
  distance: number; // in meters
  duration: number; // in seconds
  startLocation: Location;
  endLocation: Location;
  steps: RouteStep[];
}

export interface RouteSegment {
  legIndex: number;
  startLocation: Location;
  endLocation: Location;
  distance: number; // in meters
  duration: number; // in seconds
  polyline: string;
}

export interface RouteResult {
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  legs: RouteLeg[];
  overviewPolyline: string;
  waypoints: Location[];
  segments: RouteSegment[];
}

export interface DrivingPreferences {
  maxDrivingTime: number; // in hours
  preferScenic: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
}

export interface SceneryPreferences {
  coast: number; // 0-10 preference rating
  mountains: number;
  forests: number;
  lakes: number;
  desert: number;
  countryside: number;
}

export interface StopPoint {
  location: Location;
  nightsToStay: number;
  isDestination: boolean;
  sceneryTypes: string[];
}

class MapsService {
  // Geocode an address to coordinates
  async geocodeAddress(address: string): Promise<Location> {
    try {
      // Try to get from cache first
      const cachedLocation = await MapsOfflineCache.getCachedLocation(address);
      if (cachedLocation) {
        return cachedLocation;
      }

      const response = await axios.get(GOOGLE_GEOCODE_URL, {
        params: {
          address,
          key: GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const location: Location = {
        coordinates: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng
        },
        address: result.formatted_address,
        placeId: result.place_id
      };

      // Cache the result
      await MapsOfflineCache.cacheLocation(address, location);

      return location;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  // Add getRoute method to fix the error
  async getRoute(
    origin: string | Location,
    destination: string | Location,
    waypoints: Location[] = []
  ): Promise<{ route: RouteResult | null; error: Error | null }> {
    try {
      // Convert string locations to Location objects if needed
      const originLocation = typeof origin === 'string' 
        ? await this.geocodeAddress(origin) 
        : origin;
      
      const destinationLocation = typeof destination === 'string'
        ? await this.geocodeAddress(destination)
        : destination;
      
      // Set default driving preferences
      const drivingPrefs: DrivingPreferences = {
        maxDrivingTime: 8, // 8 hours default
        preferScenic: true,
        avoidTolls: false,
        avoidHighways: false
      };
      
      const route = await this.planRouteWithGoogleMaps(
        originLocation,
        destinationLocation,
        waypoints,
        drivingPrefs
      );
      
      return { route, error: null };
    } catch (error) {
      console.error('Route planning error:', error);
      return { route: null, error: error as Error };
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(coords: Coordinates): Promise<Location> {
    try {
      // Try to get from cache first
      const cacheKey = `${coords.latitude},${coords.longitude}`;
      const cachedLocation = await MapsOfflineCache.getCachedLocation(cacheKey);
      if (cachedLocation) {
        return cachedLocation;
      }

      const response = await axios.get(GOOGLE_GEOCODE_URL, {
        params: {
          latlng: `${coords.latitude},${coords.longitude}`,
          key: GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error(`Reverse geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const location: Location = {
        coordinates: coords,
        address: result.formatted_address,
        placeId: result.place_id
      };

      // Cache the result
      await MapsOfflineCache.cacheLocation(cacheKey, location);

      return location;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  // Plan a route with Google Maps API
  async planRouteWithGoogleMaps(
    origin: Location,
    destination: Location,
    waypoints: Location[] = [],
    drivingPrefs: DrivingPreferences
  ): Promise<RouteResult> {
    try {
      // Build waypoints string
      const waypointsParam = waypoints.length
        ? `via:${waypoints.map(wp => `${wp.coordinates.latitude},${wp.coordinates.longitude}`).join('|')}`
        : '';

      // Parameters based on driving preferences
      const params: Record<string, string> = {
        origin: `${origin.coordinates.latitude},${origin.coordinates.longitude}`,
        destination: `${destination.coordinates.latitude},${destination.coordinates.longitude}`,
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        alternatives: drivingPrefs.preferScenic ? 'true' : 'false'
      };

      if (waypointsParam) {
        params.waypoints = waypointsParam;
      }

      if (drivingPrefs.avoidHighways) {
        params.avoid = params.avoid ? `${params.avoid}|highways` : 'highways';
      }

      if (drivingPrefs.avoidTolls) {
        params.avoid = params.avoid ? `${params.avoid}|tolls` : 'tolls';
      }

      const response = await axios.get(GOOGLE_DIRECTIONS_URL, { params });

      if (response.data.status !== 'OK' || !response.data.routes.length) {
        throw new Error(`Route calculation failed: ${response.data.status}`);
      }

      const route = response.data.routes[0];

      // Process the response
      const legs = route.legs.map((leg: any) => {
        return {
          distance: leg.distance.value,
          duration: leg.duration.value,
          startLocation: {
            coordinates: {
              latitude: leg.start_location.lat,
              longitude: leg.start_location.lng
            },
            address: leg.start_address
          },
          endLocation: {
            coordinates: {
              latitude: leg.end_location.lat,
              longitude: leg.end_location.lng
            },
            address: leg.end_address
          },
          steps: leg.steps.map((step: any) => ({
            distance: step.distance.value,
            duration: step.duration.value,
            instructions: step.html_instructions,
            maneuver: step.maneuver,
            startLocation: {
              latitude: step.start_location.lat,
              longitude: step.start_location.lng
            },
            endLocation: {
              latitude: step.end_location.lat,
              longitude: step.end_location.lng
            }
          }))
        };
      });

      // Calculate route segments for overnight stops based on driving preferences
      const segments = this.calculateRouteSegments(legs, drivingPrefs.maxDrivingTime);

      // Combine all waypoints (origin, stops, destination)
      const allWaypoints = [
        origin,
        ...waypoints,
        destination
      ];

      const result: RouteResult = {
        totalDistance: legs.reduce((acc, leg) => acc + leg.distance, 0),
        totalDuration: legs.reduce((acc, leg) => acc + leg.duration, 0),
        legs,
        overviewPolyline: route.overview_polyline.points,
        waypoints: allWaypoints,
        segments
      };

      // Cache the route for offline use
      const cacheKey = this.generateRouteCacheKey(origin, destination, waypoints);
      await MapsOfflineCache.cacheRoute(cacheKey, {
        route: {
          totalDistance: result.totalDistance,
          totalDuration: result.totalDuration,
          legs: result.legs,
          overviewPolyline: result.overviewPolyline,
          waypoints: result.waypoints,
          segments: result.segments
        }
      });

      return result;
    } catch (error) {
      // Try the fallback routing service
      console.warn('Google Maps routing failed, trying OpenRouteService:', error);
      return this.planRouteWithOpenRouteService(origin, destination, waypoints, drivingPrefs);
    }
  }

  // Fallback routing with OpenRouteService
  private async planRouteWithOpenRouteService(
    origin: Location,
    destination: Location,
    waypoints: Location[] = [],
    drivingPrefs: DrivingPreferences
  ): Promise<RouteResult> {
    try {
      const coordinates = [
        [origin.coordinates.longitude, origin.coordinates.latitude],
        ...waypoints.map(wp => [wp.coordinates.longitude, wp.coordinates.latitude]),
        [destination.coordinates.longitude, destination.coordinates.latitude]
      ];

      const options: Record<string, any> = {
        preference: drivingPrefs.preferScenic ? 'recommended' : 'fastest',
        options: {}
      };

      if (drivingPrefs.avoidTolls) {
        options.options.avoid_features = ['tollways'];
      }

      if (drivingPrefs.avoidHighways) {
        options.options.avoid_features = options.options.avoid_features || [];
        options.options.avoid_features.push('highways');
      }

      const response = await axios.post(
        ORS_DIRECTIONS_URL,
        {
          coordinates,
          ...options
        },
        {
          headers: {
            'Authorization': ORS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.routes || !response.data.routes.length) {
        throw new Error('Route calculation failed with OpenRouteService');
      }

      const route = response.data.routes[0];
      
      // Process the segments
      const segments = route.segments.map((segment: any, index: number) => {
        const steps = segment.steps.map((step: any) => ({
          distance: step.distance,
          duration: step.duration,
          instructions: step.instruction,
          startLocation: {
            latitude: step.way_points[0][1],
            longitude: step.way_points[0][0]
          },
          endLocation: {
            latitude: step.way_points[1][1],
            longitude: step.way_points[1][0]
          }
        }));

        const startPoint = index === 0 ? origin : waypoints[index - 1];
        const endPoint = index === route.segments.length - 1 
          ? destination 
          : waypoints[index];

        return {
          distance: segment.distance,
          duration: segment.duration,
          startLocation: {
            coordinates: {
              latitude: startPoint.coordinates.latitude,
              longitude: startPoint.coordinates.longitude
            },
            address: startPoint.address
          },
          endLocation: {
            coordinates: {
              latitude: endPoint.coordinates.latitude,
              longitude: endPoint.coordinates.longitude
            },
            address: endPoint.address
          },
          steps
        };
      });

      // Calculate route segments for overnight stops
      const routeSegments = this.calculateRouteSegments(segments, drivingPrefs.maxDrivingTime);

      const result: RouteResult = {
        totalDistance: route.summary.distance,
        totalDuration: route.summary.duration,
        legs: segments,
        overviewPolyline: route.geometry,
        waypoints: [origin, ...waypoints, destination],
        segments: routeSegments
      };

      // Cache the route for offline use
      const cacheKey = this.generateRouteCacheKey(origin, destination, waypoints);
      await MapsOfflineCache.cacheRoute(cacheKey, {
        route: {
          totalDistance: result.totalDistance,
          totalDuration: result.totalDuration,
          legs: result.legs,
          overviewPolyline: result.overviewPolyline,
          waypoints: result.waypoints,
          segments: result.segments
        }
      });

      return result;
    } catch (error) {
      console.error('OpenRouteService routing error:', error);
      throw new Error('Route calculation failed with both services');
    }
  }

  // Plan an optimal route with stops based on driving preferences
  async planOptimalRoute(
    origin: Location,
    destination: Location,
    drivingPrefs: DrivingPreferences,
    sceneryPrefs: SceneryPreferences
  ): Promise<{ route: RouteResult; suggestedStops: StopPoint[] }> {
    try {
      // First, get a direct route to understand total distance and time
      const directRoute = await this.planRouteWithGoogleMaps(
        origin,
        destination,
        [],
        drivingPrefs
      );

      // Calculate number of days needed based on max driving time
      const totalHours = directRoute.totalDuration / 3600; // Convert seconds to hours
      const daysNeeded = Math.ceil(totalHours / drivingPrefs.maxDrivingTime);
      
      // If we can drive in one day, no stops needed
      if (daysNeeded <= 1) {
        return {
          route: directRoute,
          suggestedStops: [
            {
              location: destination,
              nightsToStay: 1,
              isDestination: true,
              sceneryTypes: []
            }
          ]
        };
      }

      // Calculate approximate stopping points
      const stops: StopPoint[] = [];
      
      // Calculate segments for overnight stops
      const segments = this.calculateRouteSegments(directRoute.legs, drivingPrefs.maxDrivingTime);
      
      // For each segment endpoint, find an appropriate stopping location
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastStop = i === segments.length - 1;
        
        // Last segment should be the destination
        const stopLocation = isLastStop ? destination : segment.endLocation;
        
        // Determine scenery types based on location and preferences
        // This is a simplified version - in reality, we'd use an API to determine
        // what types of scenery are available at each potential stopping point
        const sceneryTypes = await this.determineSceneryTypes(
          stopLocation.coordinates,
          sceneryPrefs
        );
        
        stops.push({
          location: stopLocation,
          nightsToStay: 1, // Default to 1 night per stop
          isDestination: isLastStop,
          sceneryTypes
        });
      }

      // Recalculate the route with these waypoints
      const waypointsForRouting = stops
        .filter(stop => !stop.isDestination)
        .map(stop => stop.location);
      
      const finalRoute = await this.planRouteWithGoogleMaps(
        origin,
        destination,
        waypointsForRouting,
        drivingPrefs
      );

      return {
        route: finalRoute,
        suggestedStops: stops
      };
    } catch (error) {
      console.error('Optimal route planning error:', error);
      throw error;
    }
  }

  // Download and cache map tiles for offline use
  async cacheMapTilesForRoute(route: RouteResult, zoomLevels = [10, 12, 14]): Promise<void> {
    try {
      // Extract all unique coordinates from the route
      const allPoints: Coordinates[] = [];
      
      // Add all waypoints
      route.waypoints.forEach(waypoint => {
        allPoints.push(waypoint.coordinates);
      });
      
      // Add points along the route at regular intervals
      const decodedPolyline = this.decodePolyline(route.overviewPolyline);
      
      // Take points at regular intervals to avoid caching too many tiles
      const step = Math.max(1, Math.floor(decodedPolyline.length / 100));
      for (let i = 0; i < decodedPolyline.length; i += step) {
        allPoints.push(decodedPolyline[i]);
      }
      
      // Calculate required tiles
      const tiles: { x: number; y: number; z: number }[] = [];
      
      for (const point of allPoints) {
        for (const zoom of zoomLevels) {
          const tile = this.getTileCoordinates(point.latitude, point.longitude, zoom);
          
          // Check if this tile is already in our list
          const tileExists = tiles.some(t => 
            t.x === tile.x && t.y === tile.y && t.z === tile.z
          );
          
          if (!tileExists) {
            tiles.push(tile);
          }
        }
      }
      
      // Determine tile provider based on platform
      const tileProvider = Platform.OS === 'ios' 
        ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      
      // Download and cache tiles
      const promises = tiles.map(tile => {
        const url = tileProvider
          .replace('{x}', tile.x.toString())
          .replace('{y}', tile.y.toString())
          .replace('{z}', tile.z.toString());
        
        return this.downloadAndCacheTile(url, tile);
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error caching map tiles:', error);
      throw error;
    }
  }

  // Helper method to calculate segments based on max driving time
  private calculateRouteSegments(
    legs: RouteLeg[], 
    maxDrivingHours: number
  ): RouteSegment[] {
    const segments: RouteSegment[] = [];
    const maxDrivingSeconds = maxDrivingHours * 3600;
    
    let currentSegment: RouteSegment | null = null;
    let currentDuration = 0;
    
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      
      // If we don't have a current segment or adding this leg would exceed max time
      if (currentSegment === null || currentDuration + leg.duration > maxDrivingSeconds) {
        // If we already have a segment, add it to our results
        if (currentSegment !== null) {
          segments.push(currentSegment);
        }
        
        // Start a new segment
        currentSegment = {
          legIndex: i,
          startLocation: leg.startLocation,
          endLocation: leg.endLocation,
          distance: leg.distance,
          duration: leg.duration,
          polyline: '' // We'll encode steps later
        };
        currentDuration = leg.duration;
      } else {
        // Add this leg to the current segment
        currentSegment.endLocation = leg.endLocation;
        currentSegment.distance += leg.distance;
        currentSegment.duration += leg.duration;
        currentDuration += leg.duration;
      }
    }
    
    // Add the final segment if we have one
    if (currentSegment !== null) {
      segments.push(currentSegment);
    }
    
    return segments;
  }

  // Helper to determine scenery types near a location
  private async determineSceneryTypes(
    coords: Coordinates,
    preferences: SceneryPreferences
  ): Promise<string[]> {
    try {
      // In a real app, we would query an API with the coordinates
      // For this MVP, we'll simulate based on preferences
      
      // Convert preferences to an array of [type, score] pairs
      const prefArray = Object.entries(preferences)
        .map(([type, score]) => ({ type, score }))
        .filter(p => p.score > 5) // Only consider high preferences
        .sort((a, b) => b.score - a.score); // Sort by preference strength
      
      // Return the top 2-3 scenery types
      return prefArray.slice(0, 3).map(p => p.type);
    } catch (error) {
      console.error('Error determining scenery types:', error);
      return [];
    }
  }

  // Helper to generate a cache key for routes
  private generateRouteCacheKey(
    origin: Location,
    destination: Location,
    waypoints: Location[]
  ): string {
    const waypointsString = waypoints
      .map(wp => `${wp.coordinates.latitude},${wp.coordinates.longitude}`)
      .join('|');
    
    return `route:${origin.coordinates.latitude},${origin.coordinates.longitude}:${destination.coordinates.latitude},${destination.coordinates.longitude}:${waypointsString}`;
  }

  // Helper to download and cache a map tile
  private async downloadAndCacheTile(
    url: string,
    tile: { x: number; y: number; z: number }
  ): Promise<void> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const tileKey = `tile:${tile.z}:${tile.x}:${tile.y}`;
      
      // Convert binary data to base64
      const base64Data = Buffer.from(response.data).toString('base64');
      
      // Cache the tile
      await OfflineService.cacheTile(tileKey, base64Data);
    } catch (error) {
      console.warn(`Failed to cache tile ${url}:`, error);
      // Continue with other tiles
    }
  }

  // Convert lat/lng to tile coordinates
  private getTileCoordinates(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
    const scale = 1 << zoom;
    const worldSize = scale * 256;
    
    const x = Math.floor(((lng + 180) / 360) * scale);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale);
    
    return { x, y, z: zoom };
  }

  // Decode a polyline to an array of coordinates
  private decodePolyline(polyline: string): Coordinates[] {
    const coordinates: Coordinates[] = [];
    let index = 0;
    const len = polyline.length;
    let lat = 0;
    let lng = 0;
    
    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      
      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      
      shift = 0;
      result = 0;
      
      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      
      coordinates.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5
      });
    }
    
    return coordinates;
  }

  // Add searchLocation method
  async searchLocation(query: string): Promise<{ locations: Location[] | null; error: Error | null }> {
    try {
      console.log(`Searching location with query: "${query}"`);
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API Key is missing');
      }

      // Try cache first - TEMPORARILY REMOVED
      // const cached = await MapsOfflineCache.getCachedSearch(query);
      // if (cached) {
      //   console.log(`Returning cached search results for "${query}"`);
      //   return { locations: cached, error: null };
      // }

      const response = await axios.get(GOOGLE_GEOCODE_URL, {
        params: {
          address: query,
          key: GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status !== 'OK') {
        // Handle ZERO_RESULTS specifically
        if (response.data.status === 'ZERO_RESULTS') {
          console.log(`Zero results found for query: "${query}"`);
          return { locations: [], error: null }; 
        }
        throw new Error(`Geocoding search failed: ${response.data.status} - ${response.data.error_message || ''}`);
      }

      const results = response.data.results;
      const locations: Location[] = results.map((result: any) => ({
        coordinates: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng
        },
        address: result.formatted_address,
        placeId: result.place_id
      }));

      // Cache the results - TEMPORARILY REMOVED
      // await MapsOfflineCache.cacheSearch(query, locations);

      console.log(`Found ${locations.length} locations for query: "${query}"`);
      return { locations, error: null };

    } catch (error) {
      console.error('Error in searchLocation:', error);
      return { locations: null, error: error as Error };
    }
  }

  // Add searchNearbyPlaces method to find RV parks and campgrounds near a location
  async searchNearbyPlaces(location: Coordinates, radius: number = 50000, type: string = 'rv_park'): Promise<{ places: any[] | null; error: Error | null }> {
    try {
      const cacheKey = `nearby:${location.latitude},${location.longitude}:${radius}:${type}`;
      
      const cachedResults = await MapsOfflineCache.getCachedSearchResults(cacheKey);
      if (cachedResults) {
        console.log(`Found ${cachedResults.length} cached places near ${location.latitude},${location.longitude}`);
        return { places: cachedResults, error: null };
      }

      console.log(`Searching for ${type} near ${location.latitude},${location.longitude} within ${radius}m using Places API`);
      
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API Key is missing for Places search');
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location: `${location.latitude},${location.longitude}`,
          radius: radius, // radius in meters
          // Use 'type' for broader category, 'keyword' for specific terms
          type: type, 
          keyword: 'rv park campground camping', // Help filter results
          key: GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        console.error('Places Nearby Search failed:', response.data.status, response.data.error_message);
        throw new Error(`Nearby places search failed: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
      }

      const places = response.data.results || [];
      console.log(`Places API found ${places.length} results near ${location.latitude},${location.longitude}`);
      
      // Cache results (using the correct function name if it exists)
      // Assuming MapsOfflineCache has a method like cacheSearchResults
      try {
         await MapsOfflineCache.cacheSearchResults(cacheKey, places); 
      } catch(cacheError) {
         console.warn("Failed to cache nearby search results:", cacheError);
      }

      // Map results to a simpler format if needed, or return raw Places API results
      // For now, return raw results
      return { places, error: null };

    } catch (error) {
      console.error('Nearby places search error:', error);
      return { places: null, error: error as Error };
    }
  }
}

// Export singleton instance
const mapsServiceInstance = new MapsService();
export default mapsServiceInstance; 