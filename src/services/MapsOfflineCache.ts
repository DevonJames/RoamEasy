import AsyncStorage from '@react-native-async-storage/async-storage';

// Prefixes for AsyncStorage keys
const LOCATION_CACHE_PREFIX = 'map_location_';
const ROUTE_CACHE_PREFIX = 'map_route_';

/**
 * Provides caching functionality for map-related data
 */
class MapsOfflineCache {
  /**
   * Cache a geocoded location
   */
  static async cacheLocation(key: string, location: any): Promise<void> {
    try {
      const storageKey = `${LOCATION_CACHE_PREFIX}${key}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(location));
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }

  /**
   * Get a cached location by key
   */
  static async getCachedLocation(key: string): Promise<any | null> {
    try {
      const storageKey = `${LOCATION_CACHE_PREFIX}${key}`;
      const data = await AsyncStorage.getItem(storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cached location:', error);
      return null;
    }
  }

  /**
   * Cache a calculated route
   */
  static async cacheRoute(key: string, route: any): Promise<void> {
    try {
      const storageKey = `${ROUTE_CACHE_PREFIX}${key}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(route));
    } catch (error) {
      console.error('Error caching route:', error);
    }
  }

  /**
   * Get a cached route by key
   */
  static async getCachedRoute(key: string): Promise<any | null> {
    try {
      const storageKey = `${ROUTE_CACHE_PREFIX}${key}`;
      const data = await AsyncStorage.getItem(storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cached route:', error);
      return null;
    }
  }
}

export default MapsOfflineCache; 