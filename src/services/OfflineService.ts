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
      console.log(`Caching trip ${trip.id} with ${trip.stops?.length || 0} stops`);
      
      // Ensure the trip has a stops array (could be in trip_stops from Supabase)
      const enhancedTrip = {
        ...trip,
        stops: trip.stops || (trip as any).trip_stops || []
      };
      
      // Remove trip_stops to avoid duplication
      if ('trip_stops' in enhancedTrip) {
        delete (enhancedTrip as any).trip_stops;
      }
      
      console.log(`Enhanced trip has ${enhancedTrip.stops?.length || 0} stops for caching`);
      
      // Cache each stop individually
      if (enhancedTrip.stops && enhancedTrip.stops.length > 0) {
        console.log(`Individually caching ${enhancedTrip.stops.length} stops for trip ${trip.id}`);
        for (const stop of enhancedTrip.stops) {
          await this.cacheStop(stop);
        }
      }
      
      // Cache the whole trip
      const key = `${TRIP_PREFIX}${trip.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(enhancedTrip));
      
      console.log(`Successfully cached trip ${trip.id} with ${enhancedTrip.stops?.length || 0} stops`);
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
      const trips = tripData
        .map(([_, value]) => (value ? JSON.parse(value) : null))
        .filter((trip): trip is Trip => trip !== null);
        
      console.log(`Retrieved ${trips.length} cached trips`);
      
      // Make sure each trip has a valid stops array
      return trips.map(trip => {
        // Ensure the trip has stops
        const enhancedTrip = {
          ...trip,
          stops: trip.stops || (trip as any).trip_stops || []
        };
        
        // Remove trip_stops to avoid duplication
        if ('trip_stops' in enhancedTrip) {
          delete (enhancedTrip as any).trip_stops;
        }
        
        return enhancedTrip;
      });
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
        console.log(`No cached trip found for ID: ${tripId}`);
        return null;
      }
      
      const trip = JSON.parse(tripData) as Trip;
      
      // Ensure the trip has a valid stops array
      const enhancedTrip = {
        ...trip,
        stops: trip.stops || (trip as any).trip_stops || []
      };
      
      // Remove trip_stops to avoid duplication
      if ('trip_stops' in enhancedTrip) {
        delete (enhancedTrip as any).trip_stops;
      }
      
      // Look for individually cached stops for this trip
      const keys = await AsyncStorage.getAllKeys();
      const stopKeys = keys.filter(key => key.startsWith('tripStop_'));
      
      if (stopKeys.length > 0) {
        // Get all cached stops
        const stopsData = await AsyncStorage.multiGet(stopKeys);
        const stops = stopsData
          .map(([_, value]) => (value ? JSON.parse(value) : null))
          .filter(stop => stop !== null);
        
        // Filter stops for this trip and add any that aren't already in the stops array
        const tripStops = stops.filter(stop => stop.trip_id === tripId);
        
        if (tripStops.length > 0) {
          console.log(`Found ${tripStops.length} individually cached stops for trip ${tripId}`);
          
          // Get existing stop IDs
          const existingStopIds = new Set(enhancedTrip.stops.map(stop => stop.id));
          
          // Add stops that aren't already in the array
          for (const stop of tripStops) {
            if (!existingStopIds.has(stop.id)) {
              enhancedTrip.stops.push(stop);
              console.log(`Added missing stop ${stop.id} to trip ${tripId}`);
            }
          }
          
          // Re-sort stops by stop_order if available
          if (enhancedTrip.stops.length > 0) {
            // Check if we have stops with stopOrder or stop_order
            if ('stopOrder' in enhancedTrip.stops[0]) {
              enhancedTrip.stops.sort((a, b) => a.stopOrder - b.stopOrder);
            } else if ('stop_order' in enhancedTrip.stops[0]) {
              enhancedTrip.stops.sort((a: any, b: any) => a.stop_order - b.stop_order);
            }
          }
        }
      }
      
      console.log(`Retrieved cached trip ${tripId} with ${enhancedTrip.stops?.length || 0} stops`);
      
      return enhancedTrip;
    } catch (error) {
      console.error('Error getting cached trip:', error);
      throw new Error('Failed to get cached trip');
    }
  }

  /**
   * Queue an item for sync when online
   * @param action - Action type ('trip', 'stop', 'delete', 'reorder')
   * @param data - Data to sync
   */
  async queueForSync(action: string, data: any): Promise<void> {
    try {
      // Get current sync queue
      const queueData = await AsyncStorage.getItem('sync_queue');
      const queue = queueData ? JSON.parse(queueData) : [];
      
      // Add item to queue
      queue.push({
        action,
        data,
        timestamp: new Date().toISOString()
      });
      
      // Save updated queue
      await AsyncStorage.setItem('sync_queue', JSON.stringify(queue));
      console.log(`Queued ${action} for sync: `, data);
    } catch (error) {
      console.error('Error queuing for sync:', error);
      throw new Error('Failed to queue for sync');
    }
  }

  /**
   * Remove a trip from offline storage 
   * @param tripId - ID of the trip to remove
   */
  async removeTrip(tripId: string): Promise<void> {
    try {
      console.log(`Removing trip ${tripId} from offline storage`);
      
      // Same implementation as clearTripCache
      // Get the trip to find associated resort IDs and map regions
      const trip = await this.getCachedTrip(tripId);
      
      if (!trip) {
        console.log(`No trip found with ID: ${tripId}`);
        return;
      }
      
      // 1. Clear the trip itself
      const tripKey = `${TRIP_PREFIX}${tripId}`;
      await AsyncStorage.removeItem(tripKey);
      
      // 2. Clear all associated stops
      if (trip.stops && trip.stops.length > 0) {
        console.log(`Removing ${trip.stops.length} stops for trip ${tripId}`);
        
        for (const stop of trip.stops) {
          const stopKey = `tripStop_${stop.id}`;
          await AsyncStorage.removeItem(stopKey);
        }
        
        // Also remove resort data if needed
        const resortIds = trip.stops
          .filter(stop => stop.resortId)
          .map(stop => stop.resortId);
          
        if (resortIds.length > 0) {
          const resortKeys = resortIds.map(id => `${RESORT_PREFIX}${id}`);
          
          for (const key of resortKeys) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
      
      console.log(`Successfully removed trip ${tripId} from offline storage`);
    } catch (error) {
      console.error('Error removing trip:', error);
      throw new Error('Failed to remove trip');
    }
  }

  /**
   * Process the sync queue
   * @param supabaseService - Supabase service to use for syncing
   */
  async processSyncQueue(supabaseService: any): Promise<{ processed: number; errors: number }> {
    if (!this.isConnected) {
      return { processed: 0, errors: 0 };
    }
    
    try {
      // Get current sync queue
      const queueData = await AsyncStorage.getItem('sync_queue');
      if (!queueData) {
        return { processed: 0, errors: 0 };
      }
      
      const queue = JSON.parse(queueData);
      let processed = 0;
      let errors = 0;
      
      // Process each item
      for (const item of queue) {
        try {
          switch (item.action) {
            case 'trip':
              await supabaseService.createTrip(item.data);
              break;
            case 'stop':
              if (item.data.trip_id) {
                await supabaseService.addTripStop(item.data.trip_id, item.data);
              }
              break;
            case 'delete':
              if (item.data.entity === 'trip') {
                await supabaseService.deleteTrip(item.data.id);
              } else if (item.data.entity === 'stop') {
                await supabaseService.deleteTripStop(item.data.id);
              }
              break;
            case 'reorder':
              if (item.data.entity === 'trip_stops') {
                for (const orderItem of item.data.order) {
                  await supabaseService.updateTripStop(orderItem.id, { 
                    stop_order: orderItem.stop_order || orderItem.stopOrder 
                  });
                }
              }
              break;
          }
          processed++;
        } catch (error) {
          console.error(`Error processing sync item ${item.action}:`, error);
          errors++;
        }
      }
      
      // Clear the queue if everything was processed
      if (errors === 0) {
        await AsyncStorage.removeItem('sync_queue');
      } else {
        // Keep only failed items
        const failedItems = queue.slice(processed);
        await AsyncStorage.setItem('sync_queue', JSON.stringify(failedItems));
      }
      
      return { processed, errors };
    } catch (error) {
      console.error('Error processing sync queue:', error);
      throw new Error('Failed to process sync queue');
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