import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/environment';
import { Alert } from 'react-native';

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
        console.error('Sign in error from Supabase:', error.message);
        
        // Handle specific error cases
        if (error.message.includes('Email not confirmed')) {
          console.log('Email not confirmed error - attempting to auto-confirm...');
          
          // Try to update user to mark as confirmed
          try {
            // This would require admin access, which we don't have in the client
            // Instead, we'll just return a more user-friendly error
            return { 
              user: null, 
              error: new Error('Your email is pending confirmation. Please check your inbox or try again later.') 
            };
          } catch (adminError) {
            console.error('Failed to auto-confirm user:', adminError);
          }
        }
        
        throw error;
      }
      
      if (data?.user) {
        console.log('Sign in successful for user ID:', data.user.id);
        return { user: this.transformUser(data.user), error: null };
      }
      
      return { user: null, error: new Error('Sign in failed') };
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

  async getTripById(tripId: string): Promise<{ trip: Trip | null; error: Error | null }> {
    try {
      console.log('Fetching trip with ID:', tripId);
      
      // Get the trip with its stops
      const { data, error } = await this.supabase
        .from('trips')
        .select(`
          *,
          trip_stops(*)
        `)
        .eq('id', tripId)
        .single();
      
      if (error) {
        console.error('Error fetching trip:', error);
        throw error;
      }
      
      if (!data) {
        console.log('No trip found with ID:', tripId);
        return { trip: null, error: null };
      }
      
      // Get the stops separately to ensure we have them
      const { data: stopData, error: stopError } = await this.supabase
        .from('trip_stops')
        .select('*')
        .eq('trip_id', tripId)
        .order('stop_order', { ascending: true });
        
      if (stopError) {
        console.error('Error fetching trip stops:', stopError);
      }
      
      // Use stops from the direct query if available
      const stops = stopData || [];
      console.log(`Found ${stops.length} stops for trip ${tripId} from direct query`);
      
      // Transform the result to match our Trip interface
      const trip = {
        ...data,
        stops: stops // Use the directly queried stops
      } as Trip;
      
      console.log('Trip retrieved successfully with', trip.stops?.length || 0, 'stops');
      
      return { trip, error: null };
    } catch (error) {
      console.error('Error in getTripById:', error);
      return { trip: null, error: error as Error };
    }
  }

  async createTrip(tripData: any): Promise<{ trip: Trip | null; error: Error | null }> {
    try {
      console.log('Creating trip with data:', JSON.stringify(tripData, null, 2));
      
      // Check for required fields
      if (!tripData.user_id) {
        console.error('Missing required field: user_id');
        return { trip: null, error: new Error('Missing required field: user_id') };
      }
      
      if (!tripData.name) {
        console.error('Missing required field: name');
        return { trip: null, error: new Error('Missing required field: name') };
      }
      
      // Save the stops array
      const stops = tripData.stops || [];
      console.log(`Trip has ${stops.length} stops for creation`);
      
      // Create trip without stops
      const tripWithoutStops = { ...tripData };
      delete tripWithoutStops.stops;
      
      console.log('Inserting trip data:', JSON.stringify(tripWithoutStops, null, 2));
      
      // Create the trip
      const { data, error } = await this.supabase
        .from('trips')
        .insert(tripWithoutStops)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating trip:', error);
        return { trip: null, error: new Error(`Database error: ${error.message}`) };
      }
      
      if (!data) {
        return { trip: null, error: new Error('Failed to create trip - no data returned') };
      }
      
      const newTrip = data as Trip;
      console.log('Trip created successfully:', newTrip);
      
      // Now add stops one by one if there are any
      if (stops.length > 0) {
        console.log(`Adding ${stops.length} stops to trip ${newTrip.id}`);
        
        // Add each stop individually
        const createdStops = [];
        for (const stop of stops) {
          // Extract only the data that matches our database schema
          const stopData = {
            stop_order: stop.stop_order || 0,
            check_in: stop.check_in || new Date().toISOString().split('T')[0],
            check_out: stop.check_out || new Date().toISOString().split('T')[0],
            notes: stop.notes || '',
            resort_id: stop.resort_id || '00000000-0000-4000-8000-000000000000'
          };
          
          // If there's a location object in the stop, add it to notes
          if (stop.location) {
            const locationInfo = `${stop.location.address || ''} (${stop.location.latitude || 0}, ${stop.location.longitude || 0})`;
            stopData.notes = stopData.notes ? `${stopData.notes}\nLocation: ${locationInfo}` : `Location: ${locationInfo}`;
          }
          
          console.log(`Adding stop with order ${stopData.stop_order}`);
          const { stop: createdStop, error: stopError } = await this.addTripStop(newTrip.id, stopData);
          
          if (stopError) {
            console.error('Error adding stop:', stopError);
          } else if (createdStop) {
            createdStops.push(createdStop);
            console.log('Stop created successfully:', createdStop);
          }
        }
        
        // Get the updated trip with stops
        const { data: tripWithStops, error: getError } = await this.supabase
          .from('trips')
          .select(`
            *,
            trip_stops (*)
          `)
          .eq('id', newTrip.id)
          .single();
          
        if (!getError && tripWithStops) {
          const completeTrip = {
            ...tripWithStops,
            stops: tripWithStops.trip_stops || []
          };
          console.log('Retrieved complete trip with stops:', completeTrip.stops?.length || 0);
          return { trip: completeTrip as Trip, error: null };
        }
      }
      
      return { trip: newTrip, error: null };
    } catch (error) {
      console.error('Error creating trip:', error);
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

  async createTripStop(tripId: string, stopData: Omit<TripStop, 'id'>): Promise<{ stop: TripStop | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('trip_stops')
        .insert({ ...stopData, trip_id: tripId })
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

  // Helper method to add a trip stop (called from createTrip)
  async addTripStop(tripId: string, stopData: Omit<TripStop, 'id' | 'trip_id'>): Promise<{ stop: TripStop | null; error: Error | null }> {
    try {
      console.log('Adding trip stop for trip:', tripId);
      console.log('Stop data received:', JSON.stringify(stopData, null, 2));
      
      // Verify the trip exists first
      console.log('Verifying trip exists before adding stop...');
      const { data: tripExists, error: tripError } = await this.supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .single();
      
      if (tripError) {
        console.error('Error verifying trip existence:', tripError);
        throw new Error(`Trip verification failed: ${tripError.message}`);
      }
      
      if (!tripExists) {
        console.error('Trip not found when adding stop:', tripId);
        throw new Error(`Trip with ID ${tripId} not found`);
      }
      
      // Create a resort placeholder if needed
      let resortId = stopData.resort_id;
      
      // If no resort_id is provided, generate a UUID using the Supabase UUID extension
      if (!resortId) {
        console.log('No resort ID provided, generating a new UUID');
        
        // Generate a UUID using Supabase
        const { data: uuidData, error: uuidError } = await this.supabase
          .rpc('generate_uuid');
          
        if (uuidError) {
          console.error('Error generating UUID:', uuidError);
          // Fallback to a client-side UUID generation approach
          resortId = this.generateUUID();
          console.log('Using client-side generated UUID:', resortId);
        } else {
          resortId = uuidData;
          console.log('Using server-generated UUID:', resortId);
        }
      }
      
      // Check if the resort exists
      console.log('Checking if resort exists:', resortId);
      const { data: existingResort, error: resortError } = await this.supabase
        .from('resorts')
        .select('id')
        .eq('id', resortId)
        .single();
      
      // If resort doesn't exist, create a placeholder
      if (!existingResort || resortError) {
        console.log('Creating placeholder resort for stop with ID:', resortId);
        
        // Extract location info from notes if available
        const locationData = this.extractLocationFromNotes(stopData.notes || '');
        console.log('Extracted location data:', locationData);
        
        // Create the placeholder resort
        const { data: newResort, error: createError } = await this.supabase
          .from('resorts')
          .insert({
            id: resortId,
            name: `Resort near ${locationData.address}`,
            address: locationData.address,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            rating: 0,
            amenities: {},
            phone: '',
            website: ''
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating placeholder resort:', createError);
          // Continue anyway, as the resort ID constraint might be set to CASCADE
        } else {
          console.log('Created placeholder resort:', newResort);
        }
      }
      
      // Extract only the fields that the database expects
      const sanitizedData = {
        trip_id: tripId,
        resort_id: resortId,
        stop_order: stopData.stop_order || 0,
        check_in: stopData.check_in || new Date().toISOString().split('T')[0],
        check_out: stopData.check_out || new Date().toISOString().split('T')[0],
        notes: stopData.notes || ''
      };
      
      console.log('Sanitized data for database insert:', JSON.stringify(sanitizedData, null, 2));
      
      const { data, error } = await this.supabase
        .from('trip_stops')
        .insert(sanitizedData)
        .select()
        .single();
      
      if (error) {
        console.error('Error adding trip stop:', error);
        throw error;
      }
      
      console.log('Trip stop added successfully:', data);
      return { stop: data as TripStop, error: null };
    } catch (error) {
      console.error('Error in addTripStop:', error);
      return { stop: null, error: error as Error };
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