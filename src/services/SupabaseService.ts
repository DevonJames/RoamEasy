import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  created_at: string;
  updated_at: string;
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
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
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
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.user) {
        return { user: this.transformUser(data.user), error: null };
      }
      
      return { user: null, error: new Error('User creation failed') };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.user) {
        return { user: this.transformUser(data.user), error: null };
      }
      
      return { user: null, error: new Error('Sign in failed') };
    } catch (error) {
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
      const { data, error } = await this.supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return { trip: data as Trip, error: null };
    } catch (error) {
      return { trip: null, error: error as Error };
    }
  }

  async createTrip(userId: string, tripName: string): Promise<{ trip: Trip | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('trips')
        .insert({ user_id: userId, name: tripName })
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
}

export default SupabaseService.getInstance(); // Export singleton instance 