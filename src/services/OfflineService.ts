import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Trip, TripStop } from '../types/trip';
import { Resort } from '../types/resort';

// Storage key prefixes
const TRIP_PREFIX = 'trip_';
const RESORT_PREFIX = 'resort_';
const MAP_TILE_PREFIX = 'map_tile_';

class OfflineService {
  private isConnected = true;
  private static instance: OfflineService;

  private constructor() {
    // Initialize network connectivity listener
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected || false;
    });
  }

  // Get singleton instance
  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  // Check if network is available
  isNetworkAvailable(): boolean {
    return this.isConnected;
  }

  /**
   * Cache a trip for offline access
   * @param trip - The trip to cache
   */
  async cacheTrip(trip: Trip): Promise<void> {
    try {
      const key = `${TRIP_PREFIX}${trip.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(trip));
    } catch (error) {
      console.error('Error caching trip:', error);
      throw new Error('Failed to cache trip');
    }
  }

  /**
   * Cache a resort for offline access
   * @param resort - The resort to cache
   */
  async cacheResort(resort: Resort): Promise<void> {
    try {
      const key = `${RESORT_PREFIX}${resort.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(resort));
    } catch (error) {
      console.error('Error caching resort:', error);
      throw new Error('Failed to cache resort');
    }
  }

  /**
   * Cache multiple resorts
   * @param resorts - Array of resorts to cache
   */
  async cacheResorts(resorts: Resort[]): Promise<void> {
    try {
      const promises = resorts.map(resort => this.cacheResort(resort));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error caching resorts:', error);
      throw new Error('Failed to cache resorts');
    }
  }

  /**
   * Cache map tiles for a region
   * @param bounds - Northeast and southwest coordinates of the region
   * @param zoomLevels - Array of zoom levels to cache
   * @returns Number of tiles cached
   */
  async cacheMapTiles(
    bounds: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    },
    zoomLevels: number[] = [10, 12, 14]
  ): Promise<number> {
    try {
      // In a real implementation, this would fetch and store actual map tiles
      // This is a simplified version that just stores the boundaries
      let tileCount = 0;
      
      for (const zoom of zoomLevels) {
        // Calculate how many tiles would be in this region at this zoom level
        // Simplified calculation for demonstration purposes
        const tilesX = Math.ceil(Math.abs(bounds.northeast.lng - bounds.southwest.lng) * Math.pow(2, zoom) / 360);
        const tilesY = Math.ceil(Math.abs(bounds.northeast.lat - bounds.southwest.lat) * Math.pow(2, zoom) / 180);
        
        const totalTiles = tilesX * tilesY;
        tileCount += totalTiles;
        
        // Store the bounds info at this zoom level
        const key = `${MAP_TILE_PREFIX}bounds_${zoom}`;
        await AsyncStorage.setItem(key, JSON.stringify(bounds));
      }
      
      return tileCount;
    } catch (error) {
      console.error('Error caching map tiles:', error);
      throw new Error('Failed to cache map tiles');
    }
  }

  /**
   * Cache a single map tile
   * @param tileId - Tile identifier
   * @param zoom - Zoom level
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param data - Tile data (usually base64 encoded image)
   */
  async cacheTile(tileId: string, zoom: number, x: number, y: number, data: string): Promise<void> {
    try {
      const key = `${MAP_TILE_PREFIX}${zoom}_${x}_${y}`;
      await AsyncStorage.setItem(key, data);
    } catch (error) {
      console.error('Error caching map tile:', error);
      throw new Error('Failed to cache map tile');
    }
  }

  /**
   * Get all cached trips
   * @returns Array of cached trips
   */
  async getCachedTrips(): Promise<Trip[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const tripKeys = keys.filter(key => key.startsWith(TRIP_PREFIX));
      
      if (tripKeys.length === 0) {
        return [];
      }
      
      const tripData = await AsyncStorage.multiGet(tripKeys);
      return tripData
        .map(([_, value]) => (value ? JSON.parse(value) : null))
        .filter((trip): trip is Trip => trip !== null);
    } catch (error) {
      console.error('Error getting cached trips:', error);
      throw new Error('Failed to get cached trips');
    }
  }

  /**
   * Get a specific cached trip
   * @param tripId - ID of the trip to retrieve
   * @returns The cached trip or null if not found
   */
  async getCachedTrip(tripId: string): Promise<Trip | null> {
    try {
      const key = `${TRIP_PREFIX}${tripId}`;
      const tripData = await AsyncStorage.getItem(key);
      
      if (!tripData) {
        return null;
      }
      
      return JSON.parse(tripData) as Trip;
    } catch (error) {
      console.error('Error getting cached trip:', error);
      throw new Error('Failed to get cached trip');
    }
  }

  /**
   * Cache a trip stop
   * @param stop - The trip stop to cache
   */
  async cacheStop(stop: TripStop): Promise<void> {
    try {
      const key = `tripStop_${stop.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(stop));
    } catch (error) {
      console.error('Error caching trip stop:', error);
      throw new Error('Failed to cache trip stop');
    }
  }

  /**
   * Get all cached resorts for a trip
   * @param tripId - ID of the trip to get resorts for
   * @returns Array of cached resorts
   */
  async getCachedResorts(tripId: string): Promise<Resort[]> {
    try {
      // First get the trip to find associated resort IDs
      const trip = await this.getCachedTrip(tripId);
      
      if (!trip || !trip.stops) {
        return [];
      }
      
      // Get resort IDs from trip stops
      const resortIds = trip.stops
        .filter(stop => stop.resortId)
        .map(stop => stop.resortId as string);
      
      if (resortIds.length === 0) {
        return [];
      }
      
      // Get all resorts
      const resortKeys = resortIds.map(id => `${RESORT_PREFIX}${id}`);
      const resortData = await AsyncStorage.multiGet(resortKeys);
      
      return resortData
        .map(([_, value]) => (value ? JSON.parse(value) : null))
        .filter((resort): resort is Resort => resort !== null);
    } catch (error) {
      console.error('Error getting cached resorts:', error);
      throw new Error('Failed to get cached resorts');
    }
  }

  /**
   * Get a specific cached resort
   * @param resortId - ID of the resort to retrieve
   * @returns The cached resort or null if not found
   */
  async getCachedResort(resortId: string): Promise<Resort | null> {
    try {
      const key = `${RESORT_PREFIX}${resortId}`;
      const resortData = await AsyncStorage.getItem(key);
      
      if (!resortData) {
        return null;
      }
      
      return JSON.parse(resortData) as Resort;
    } catch (error) {
      console.error('Error getting cached resort:', error);
      throw new Error('Failed to get cached resort');
    }
  }

  /**
   * Get cached map tiles for a region
   * @param bounds - Region boundaries
   * @param zoom - Zoom level
   * @returns Array of tile data
   */
  async getCachedMapTiles(
    bounds: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    },
    zoom: number
  ): Promise<Array<{
    id: string;
    zoom: number;
    x: number;
    y: number;
    data: string;
  }>> {
    try {
      // In a real implementation, this would query for actual map tiles in the region
      // This is a simplified version that checks if we've cached this region at this zoom
      
      const key = `${MAP_TILE_PREFIX}bounds_${zoom}`;
      const storedBoundsData = await AsyncStorage.getItem(key);
      
      if (!storedBoundsData) {
        return [];
      }
      
      // In a real app, we would now check which actual tiles we have for this region
      // and return their data. Here we'll simulate having a few tiles.
      
      const mockTiles = [];
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          mockTiles.push({
            id: `tile_${zoom}_${x}_${y}`,
            zoom,
            x,
            y,
            data: `mock_tile_data_for_${zoom}_${x}_${y}`
          });
        }
      }
      
      return mockTiles;
    } catch (error) {
      console.error('Error getting cached map tiles:', error);
      throw new Error('Failed to get cached map tiles');
    }
  }

  /**
   * Get cached tile data
   * @param zoom - Zoom level
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Tile data or null if not cached
   */
  async getCachedTile(zoom: number, x: number, y: number): Promise<string | null> {
    try {
      const key = `${MAP_TILE_PREFIX}${zoom}_${x}_${y}`;
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting cached tile:', error);
      throw new Error('Failed to get cached tile');
    }
  }

  /**
   * Clear all cached data for a specific trip
   * @param tripId - ID of the trip to clear
   */
  async clearTripCache(tripId: string): Promise<void> {
    try {
      // Get the trip to find associated resort IDs and map regions
      const trip = await this.getCachedTrip(tripId);
      
      if (!trip) {
        return;
      }
      
      // 1. Clear the trip itself
      const tripKey = `${TRIP_PREFIX}${tripId}`;
      await AsyncStorage.removeItem(tripKey);
      
      // 2. Clear all associated resorts
      if (trip.stops) {
        const resortIds = trip.stops
          .filter(stop => stop.resortId)
          .map(stop => stop.resortId as string);
          
        const resortKeys = resortIds.map(id => `${RESORT_PREFIX}${id}`);
        
        for (const key of resortKeys) {
          await AsyncStorage.removeItem(key);
        }
      }
      
      // 3. In a real implementation, we'd also clear the map tiles
      // For this mock, we'll just clear the bounds info for each zoom level
      const keys = await AsyncStorage.getAllKeys();
      const boundKeys = keys.filter(key => key.startsWith(`${MAP_TILE_PREFIX}bounds_`));
      
      for (const key of boundKeys) {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error clearing trip cache:', error);
      throw new Error('Failed to clear trip cache');
    }
  }

  /**
   * Check if a trip is fully cached with all resources
   * @param tripId - ID of the trip to check
   * @returns Whether the trip is fully cached
   */
  async isTripCached(tripId: string): Promise<boolean> {
    try {
      // Check if the trip itself is cached
      const trip = await this.getCachedTrip(tripId);
      
      if (!trip || !trip.stops) {
        return false;
      }
      
      // Check if all resorts are cached
      const resortIds = trip.stops
        .filter(stop => stop.resortId)
        .map(stop => stop.resortId as string);
        
      for (const resortId of resortIds) {
        const resort = await this.getCachedResort(resortId);
        if (!resort) {
          return false;
        }
      }
      
      // Check if map regions are cached
      // In a real app, we'd check if all required map tiles are cached
      // Here we'll just check if we have bounds info for major zoom levels
      const zoomLevels = [10, 12, 14];
      
      for (const zoom of zoomLevels) {
        const key = `${MAP_TILE_PREFIX}bounds_${zoom}`;
        const boundsData = await AsyncStorage.getItem(key);
        
        if (!boundsData) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking if trip is cached:', error);
      throw new Error('Failed to check if trip is cached');
    }
  }

  /**
   * Get the total size of the cache in bytes
   * @returns Size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      // In a real implementation, this would calculate the actual byte size
      // of all cached items. For this mock, we'll return an estimate.
      
      const keys = await AsyncStorage.getAllKeys();
      const tripKeys = keys.filter(key => key.startsWith(TRIP_PREFIX));
      const resortKeys = keys.filter(key => key.startsWith(RESORT_PREFIX));
      const tileKeys = keys.filter(key => key.startsWith(MAP_TILE_PREFIX));
      
      // Get all values and calculate their size
      let totalSize = 0;
      
      // Trips
      const tripData = await AsyncStorage.multiGet(tripKeys);
      for (const [_, value] of tripData) {
        if (value) {
          totalSize += value.length;
        }
      }
      
      // Resorts
      const resortData = await AsyncStorage.multiGet(resortKeys);
      for (const [_, value] of resortData) {
        if (value) {
          totalSize += value.length;
        }
      }
      
      // Map tiles - in reality these would be much larger
      const tileData = await AsyncStorage.multiGet(tileKeys);
      for (const [_, value] of tileData) {
        if (value) {
          totalSize += value.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      throw new Error('Failed to calculate cache size');
    }
  }
}

// Export singleton instance
export default OfflineService.getInstance(); 