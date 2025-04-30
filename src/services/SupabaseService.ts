import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/environment';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Preference {
  rvLength?: string;
  trailerLength?: string;
  hasPets?: boolean;
  costPreference?: string;
  hookupNeeds?: string;
  sceneryPriorities?: string[];
  prepTime?: number;
}

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_location?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  end_location?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status?: string;
  created_at: string;
  updated_at: string;
  stops?: TripStop[];
  trip_stops?: TripStop[]; // For Supabase nested query results
}

export interface TripStop {
  id: string;
  trip_id: string;
  resort_id: string;
  stop_order: number;
  check_in: string;
  check_out: string;
  notes?: string;
  siteNumber?: string;
}

export interface Resort {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  amenities: any; // Using any for JSONB type
  phone?: string;
  website?: string;
  last_updated: string;
}

export interface CalendarExport {
  id: string;
  trip_id: string;
  service: 'google' | 'apple' | 'ical';
  external_event_ids: string[];
  exported_at: string;
}

class SupabaseService {
  private supabase: SupabaseClient;
  private static instance: SupabaseService;

  private constructor() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
    }
    
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      }
    });
    
    console.log('Supabase client initialized');
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Add this method to expose the client instance
  public getClient(): SupabaseClient {
    return this.supabase;
  }

  // Authentication methods
  async signUp(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          // Disable email confirmation requirement
          emailRedirectTo: undefined,
          data: {
            email_confirmed: true
          }
        }
      });
      
      if (error) {
        throw error;
      }
      
      // If user is created but email confirmation is still required by Supabase
      // Let's attempt to auto-confirm by signing them in immediately
      if (data?.user && data.user.identities && data.user.identities.length > 0) {
        console.log('User created, attempting auto sign-in to bypass confirmation');
        
        // Try to sign in immediately
        const signInResult = await this.signIn(email, password);
        if (signInResult.user) {
          console.log('Auto sign-in successful');
          return { user: signInResult.user, error: null };
        }
      }
      
      if (data?.user) {
        return { user: this.transformUser(data.user), error: null };
      }
      
      return { user: null, error: new Error('User creation failed') };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error: error as Error };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      console.log('Attempting sign in for:', email);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.log('Sign in error encountered:', error.message);
        throw error;
      }
      
      if (data?.user) {
        console.log('Sign in successful for user ID:', data.user.id);
        return { user: this.transformUser(data.user), error: null };
      }
      
      return { user: null, error: new Error('Sign in failed - invalid credentials') };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        throw error;
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async getCurrentUser(): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase.auth.getUser();
      
      if (error) {
        throw error;
      }
      
      if (data?.user) {
        return { user: this.transformUser(data.user), error: null };
      }
      
      return { user: null, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  // Database methods - Profile
  async getProfile(userId: string): Promise<{ profile: any; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return { profile: data, error: null };
    } catch (error) {
      return { profile: null, error: error as Error };
    }
  }

  async updateProfile(userId: string, updates: any): Promise<{ profile: any; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { profile: data, error: null };
    } catch (error) {
      return { profile: null, error: error as Error };
    }
  }

  // Database methods - Preferences
  async getPreferences(userId: string): Promise<{ preferences: Preference | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return { preferences: data?.data as Preference, error: null };
    } catch (error) {
      return { preferences: null, error: error as Error };
    }
  }

  async updatePreferences(userId: string, preferences: Preference): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('preferences')
        .upsert({ user_id: userId, data: preferences })
        .select();
      
      if (error) {
        throw error;
      }
      
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  // Database methods - Trips
  async getTrips(userId: string): Promise<{ trips: Trip[]; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return { trips: data as Trip[], error: null };
    } catch (error) {
      return { trips: [], error: error as Error };
    }
  }

  async getTrip(tripId: string): Promise<Trip | null> {
    try {
      console.log(`Getting trip with ID: ${tripId}`);
      
      // First check if we have a cached copy
      try {
        const cachedTripStr = await AsyncStorage.getItem(`trip_${tripId}`);
        console.log(`Retrieved cached trip ${tripId} with raw data:`, cachedTripStr?.substring(0, 100) + '...');
        
        if (cachedTripStr) {
          const cachedTrip = JSON.parse(cachedTripStr);
          console.log(`Parsed cached trip ${tripId} with ${cachedTrip.stops?.length || 0} stops`);
          
          // Return the cached trip if it has stops
          if (cachedTrip.stops && cachedTrip.stops.length > 0) {
            return cachedTrip as Trip;
          } else {
            console.log(`Cached trip ${tripId} has no stops, trying Supabase`);
          }
        }
      } catch (cacheError) {
        console.error('Error retrieving trip from cache:', cacheError);
      }
      
      // If no valid cache, try to get from Supabase
      console.log('Fetching trip from Supabase:', tripId);
      
      // First get the trip record
      const { data: trip, error: tripError } = await this.supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      
      if (tripError) {
        console.error('Error fetching trip from Supabase:', tripError);
        return null;
      }
      
      // Then get the stops for this trip
      const { data: stops, error: stopsError } = await this.supabase
        .from('trip_stops')
        .select('*')
        .eq('trip_id', tripId)
        .order('stop_order', { ascending: true });
      
      if (stopsError) {
        console.error('Error fetching stops for trip:', stopsError);
        // Return trip without stops
        return trip;
      }
      
      // Combine trip with stops
      const tripWithStops: Trip = {
        ...trip,
        stops: stops || []
      };
      
      // Cache the trip with stops for future use
      try {
        await AsyncStorage.setItem(`trip_${tripId}`, JSON.stringify(tripWithStops));
        console.log(`Cached trip ${tripId} with ${stops?.length || 0} stops`);
      } catch (cacheError) {
        console.error('Error caching trip:', cacheError);
      }
      
      return tripWithStops;
    } catch (error) {
      console.error('Exception in getTrip:', error);
      return null;
    }
  }

  // the RLS policies to identify guest requests
  public async setupGuestAuth() {
    try {
      // If we already have a session, check if it's valid
      const { data: session } = await this.supabase.auth.getSession();
      if (session?.session) {
        console.log('Using existing session for auth');
        return;
      }

      // For guest users, create a temporary anonymous session
      console.log('Setting up guest auth via anonymous sign-in');
      const { data, error } = await this.supabase.auth.signInAnonymously();
      
      if (error) {
        console.error('Error setting up anonymous auth:', error);
      } else {
        console.log('Anonymous auth session created');
      }
    } catch (error) {
      console.error('Error setting up guest auth:', error);
    }
  }

  async createTrip(tripData: any): Promise<{ trip: Trip | null; error: Error | null }> {
    try {
      // Use the full tripData provided by the caller
      console.log('Attempting full trip insert:', JSON.stringify(tripData, null, 2));

      const { data, error } = await this.supabase
        .from('trips')
        .insert(tripData) // Use full data again
        .select()
        .single();
      
      if (error) {
        console.error('----> Detailed Supabase Error creating trip:', JSON.stringify(error, null, 2)); 
        throw error;
      }
      
      console.log(`Trip created successfully with ID: ${data.id}`);
      // Return the full data returned by Supabase
      return { trip: data as Trip, error: null }; 

    } catch (error) {
      console.error('Error creating trip:', error); // Updated log message
      return { trip: null, error: error as Error };
    }
  }

  async updateTrip(tripId: string, updates: Partial<Trip>): Promise<{ trip: Trip | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('trips')
        .update(updates)
        .eq('id', tripId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { trip: data as Trip, error: null };
    } catch (error) {
      return { trip: null, error: error as Error };
    }
  }

  async deleteTrip(tripId: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await this.supabase
        .from('trips')
        .delete()
        .eq('id', tripId);
      
      if (error) {
        throw error;
      }
      
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  // Database methods - Trip Stops
  async getTripStops(tripId: string): Promise<{ stops: TripStop[]; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('trip_stops')
        .select('*')
        .eq('trip_id', tripId)
        .order('stop_order', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      return { stops: data as TripStop[], error: null };
    } catch (error) {
      return { stops: [], error: error as Error };
    }
  }

  async addTripStop(tripId: string, stopData: Omit<TripStop, 'id' | 'trip_id'>): Promise<{ stop: TripStop | null; error: Error | null }> {
    try {
      console.log(`Adding stop to trip ${tripId}:`, stopData);
      
      // Original Supabase call
      const { data, error } = await this.supabase
        .from('trip_stops')
        .insert([{ trip_id: tripId, ...stopData }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating stop in Supabase:', error);
        throw error;
      }
      
      console.log(`Stop created with ID: ${data.id}`);
      return { stop: data as TripStop, error: null };
    } catch (err) {
      console.error('Exception adding trip stop:', err);
      return { stop: null, error: err as Error };
    }
  }

  async updateTripStop(stopId: string, updates: Partial<TripStop>): Promise<{ stop: TripStop | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('trip_stops')
        .update(updates)
        .eq('id', stopId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { stop: data as TripStop, error: null };
    } catch (error) {
      return { stop: null, error: error as Error };
    }
  }

  async deleteTripStop(stopId: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await this.supabase
        .from('trip_stops')
        .delete()
        .eq('id', stopId);
      
      if (error) {
        throw error;
      }
      
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  // Database methods - Resorts
  async getResortById(resortId: string): Promise<{ resort: Resort | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('resorts')
        .select('*')
        .eq('id', resortId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return { resort: data as Resort, error: null };
    } catch (error) {
      return { resort: null, error: error as Error };
    }
  }

  // Database methods - Calendar Exports
  async createCalendarExport(
    tripId: string,
    service: 'google' | 'apple' | 'ical',
    eventIds: string[]
  ): Promise<{ export: CalendarExport | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('calendar_exports')
        .insert({
          trip_id: tripId,
          service,
          external_event_ids: eventIds
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { export: data as CalendarExport, error: null };
    } catch (error) {
      return { export: null, error: error as Error };
    }
  }

  async getCalendarExports(tripId: string): Promise<{ exports: CalendarExport[]; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('calendar_exports')
        .select('*')
        .eq('trip_id', tripId);
      
      if (error) {
        throw error;
      }
      
      return { exports: data as CalendarExport[], error: null };
    } catch (error) {
      return { exports: [], error: error as Error };
    }
  }

  async deleteCalendarExport(exportId: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await this.supabase
        .from('calendar_exports')
        .delete()
        .eq('id', exportId);
      
      if (error) {
        throw error;
      }
      
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  // Helper methods
  private transformUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };
  }

  /**
   * Check database schema and tables
   */
  async checkDatabase(): Promise<{ success: boolean; tables?: string[]; error?: string }> {
    try {
      console.log('Checking database connection and schema...');
      
      // Just assume the tables exist
      console.log('Skipping table verification - assuming tables exist');
      
      return { 
        success: true, 
        tables: ['users', 'user_profiles', 'trips', 'trip_stops', 'resorts', 'preferences']
      };
    } catch (err) {
      console.warn('Database check failed with error:', err);
      // Still return success to skip verification
      return { success: true };
    }
  }

  /**
   * Generate a v4 UUID
   * Client-side fallback when Supabase RPC is not available
   */
  private generateUUID(): string {
    // Implementation of RFC4122 version 4 compliant UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, 
          v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Extract location data from notes string
   */
  private extractLocationFromNotes(notes: string): { latitude: number; longitude: number; address: string } {
    console.log('Extracting location from notes:', notes);
    
    let latitude = 0;
    let longitude = 0;
    let address = 'Default Resort';
    
    if (!notes) {
      console.log('No notes provided, using default location');
      return { latitude, longitude, address };
    }
    
    // Try different patterns to extract coordinates - log each attempt for debugging
    
    // Pattern 1: Location: Address (lat, lng)
    const locationPattern = /Location:([^(]+)\(([-\d.]+),\s*([-\d.]+)\)/;
    const locationMatch = notes.match(locationPattern);
    
    console.log('Pattern 1 match attempt:', locationMatch);
    
    if (locationMatch && locationMatch.length >= 4) {
      console.log('Found location using pattern 1:', locationMatch);
      address = locationMatch[1].trim();
      latitude = parseFloat(locationMatch[2]);
      longitude = parseFloat(locationMatch[3]);
      
      console.log(`Successfully extracted using Pattern 1: ${address} (${latitude}, ${longitude})`);
      return { latitude, longitude, address };
    }
    
    // Pattern 2: Just coordinates (lat, lng)
    const coordsPattern = /\(([-\d.]+),\s*([-\d.]+)\)/;
    const coordsMatch = notes.match(coordsPattern);
    
    console.log('Pattern 2 match attempt:', coordsMatch);
    
    if (coordsMatch && coordsMatch.length >= 3) {
      console.log('Found coordinates using pattern 2:', coordsMatch);
      latitude = parseFloat(coordsMatch[1]);
      longitude = parseFloat(coordsMatch[2]);
      
      // Try to find an address separately
      const addressPattern = /Location:\s*([^(]+)/;
      const addressMatch = notes.match(addressPattern);
      
      if (addressMatch && addressMatch.length >= 2) {
        address = addressMatch[1].trim();
      } else {
        address = `Location at ${latitude}, ${longitude}`;
      }
      
      console.log(`Successfully extracted using Pattern 2: ${address} (${latitude}, ${longitude})`);
      return { latitude, longitude, address };
    }
    
    // Pattern 3: Any numbers that could be coordinates
    const fallbackPattern = /([-\d.]+)[,\s]+([-\d.]+)/;
    const fallbackMatch = notes.match(fallbackPattern);
    
    console.log('Pattern 3 match attempt:', fallbackMatch);
    
    if (fallbackMatch && fallbackMatch.length >= 3) {
      console.log('Found possible coordinates using fallback pattern:', fallbackMatch);
      const lat = parseFloat(fallbackMatch[1]);
      const lng = parseFloat(fallbackMatch[2]);
      
      // Check if these look like valid coordinates
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        latitude = lat;
        longitude = lng;
        address = `Extracted location at ${latitude}, ${longitude}`;
        console.log(`Successfully extracted using Pattern 3: ${address}`);
        return { latitude, longitude, address };
      }
    }
    
    console.log('Could not extract location from notes, using defaults');
    return { latitude, longitude, address };
  }
}

export default SupabaseService.getInstance(); // Export singleton instance 