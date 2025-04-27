import { useState, useEffect, useCallback } from 'react';
import SupabaseService from '../services/SupabaseService';
import OfflineService from '../services/OfflineService';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from './useAuth';

export interface SceneryPreferences {
  coast: number; // 0-10 preference weight
  mountains: number;
  forests: number;
  riverside: number;
  desert: number;
  lakeside: number;
}

export interface VehicleSpecs {
  type: 'RV' | 'Trailer' | 'Van' | 'Other';
  length: number; // feet
  hasTowed: boolean;
  towedLength?: number; // feet, optional
}

export interface HookupPreferences {
  needsElectric: boolean;
  needsWater: boolean;
  needsSewer: boolean;
  prefersFull: boolean; // Full hookups preferred
}

export interface CostPreferences {
  maxNightlyRate: number; // USD
  preferredRange: [number, number]; // Min-max range
}

export interface PetPreferences {
  hasPets: boolean;
  petTypes?: ('Dog' | 'Cat' | 'Other')[];
  petCount?: number;
}

export interface DrivingPreferences {
  maxDailyDriveTime: number; // hours
  prefersScenicRoutes: boolean;
  avoidHighways: boolean;
  avoidTolls: boolean;
}

export interface UserPreferences {
  id?: string;
  userId: string;
  vehicle: VehicleSpecs;
  hookups: HookupPreferences;
  costs: CostPreferences;
  pets: PetPreferences;
  scenery: SceneryPreferences;
  driving: DrivingPreferences;
  created_at?: string;
  updated_at?: string;
}

interface PreferencesState {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: Error | null;
  isInitialized: boolean;
}

export function usePreferences() {
  const [state, setState] = useState<PreferencesState>({
    preferences: null,
    isLoading: false,
    error: null,
    isInitialized: false,
  });

  const netInfo = useNetInfo();
  const isConnected = !!netInfo.isConnected;
  const { user, isGuest } = useAuth();
  
  // Initialize with default preferences if none exist
  const createDefaultPreferences = (): UserPreferences => {
    if (!user) throw new Error('User must be defined to create preferences');
    
    return {
      userId: user.id,
      vehicle: {
        type: 'RV',
        length: 25,
        hasTowed: false,
      },
      hookups: {
        needsElectric: true,
        needsWater: true,
        needsSewer: false,
        prefersFull: false,
      },
      costs: {
        maxNightlyRate: 75,
        preferredRange: [30, 60],
      },
      pets: {
        hasPets: false,
      },
      scenery: {
        coast: 5,
        mountains: 5,
        forests: 5,
        riverside: 5,
        desert: 3,
        lakeside: 5,
      },
      driving: {
        maxDailyDriveTime: 4,
        prefersScenicRoutes: true,
        avoidHighways: false,
        avoidTolls: false,
      },
    };
  };

  // Load preferences on mount and when user changes
  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  // Load preferences from Supabase or local storage
  const loadPreferences = async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Try to load from offline storage first
      const cachedPreferences = await OfflineService.getCachedPreferences(user.id);
      
      if (cachedPreferences) {
        setState(prev => ({
          ...prev,
          preferences: cachedPreferences,
          isLoading: false,
          isInitialized: true,
        }));
      }

      // If online and not guest, fetch from Supabase
      if (isConnected && !isGuest) {
        const { data, error } = await SupabaseService.getUserPreferences(user.id);

        if (error) {
          throw error;
        }

        if (data) {
          // Cache preferences for offline use
          await OfflineService.cachePreferences(data);
          
          setState(prev => ({
            ...prev,
            preferences: data,
            isLoading: false,
            isInitialized: true,
          }));
        } else if (!cachedPreferences) {
          // No preferences found, create defaults
          const defaultPreferences = createDefaultPreferences();
          await savePreferences(defaultPreferences);
        }
      } else if (!cachedPreferences) {
        // Offline and no cached preferences, create defaults
        const defaultPreferences = createDefaultPreferences();
        await savePreferences(defaultPreferences);
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false,
      }));
    }
  };

  // Save preferences to Supabase and local storage
  const savePreferences = async (newPreferences: UserPreferences) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Make sure userId is set
      const preferencesToSave: UserPreferences = {
        ...newPreferences,
        userId: user.id,
        updated_at: new Date().toISOString(),
      };

      // Always save to offline storage
      await OfflineService.cachePreferences(preferencesToSave);

      // Update state immediately
      setState(prev => ({
        ...prev,
        preferences: preferencesToSave,
        isInitialized: true,
      }));

      // If online and not guest, save to Supabase
      if (isConnected && !isGuest) {
        const { data, error } = await SupabaseService.saveUserPreferences(preferencesToSave);

        if (error) {
          throw error;
        }

        // Update with Supabase data (might include ID or timestamps)
        if (data) {
          setState(prev => ({
            ...prev,
            preferences: data,
            isLoading: false,
          }));
          
          // Update cache with server data
          await OfflineService.cachePreferences(data);
        }
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false,
      }));
      return { success: false, error: err as Error };
    }
  };

  // Update partial preferences
  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedPreferences = {
      ...state.preferences,
      ...updates,
      userId: user?.id || state.preferences.userId,
    };

    return savePreferences(updatedPreferences);
  };

  // Update vehicle specifications
  const updateVehicle = async (vehicleUpdates: Partial<VehicleSpecs>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedVehicle = {
      ...state.preferences.vehicle,
      ...vehicleUpdates,
    };

    return updatePreferences({ vehicle: updatedVehicle });
  };

  // Update hookup preferences
  const updateHookups = async (hookupUpdates: Partial<HookupPreferences>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedHookups = {
      ...state.preferences.hookups,
      ...hookupUpdates,
    };

    return updatePreferences({ hookups: updatedHookups });
  };

  // Update cost preferences
  const updateCosts = async (costUpdates: Partial<CostPreferences>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedCosts = {
      ...state.preferences.costs,
      ...costUpdates,
    };

    return updatePreferences({ costs: updatedCosts });
  };

  // Update pet preferences
  const updatePets = async (petUpdates: Partial<PetPreferences>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedPets = {
      ...state.preferences.pets,
      ...petUpdates,
    };

    return updatePreferences({ pets: updatedPets });
  };

  // Update scenery preferences
  const updateScenery = async (sceneryUpdates: Partial<SceneryPreferences>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedScenery = {
      ...state.preferences.scenery,
      ...sceneryUpdates,
    };

    return updatePreferences({ scenery: updatedScenery });
  };

  // Update driving preferences
  const updateDriving = async (drivingUpdates: Partial<DrivingPreferences>) => {
    if (!state.preferences) {
      return { success: false, error: new Error('Preferences not initialized') };
    }

    const updatedDriving = {
      ...state.preferences.driving,
      ...drivingUpdates,
    };

    return updatePreferences({ driving: updatedDriving });
  };

  // Reset to default preferences
  const resetToDefaults = async () => {
    const defaultPreferences = createDefaultPreferences();
    return savePreferences(defaultPreferences);
  };

  return {
    ...state,
    savePreferences,
    updatePreferences,
    updateVehicle,
    updateHookups,
    updateCosts,
    updatePets,
    updateScenery,
    updateDriving,
    resetToDefaults,
    isOnline: isConnected,
  };
} 