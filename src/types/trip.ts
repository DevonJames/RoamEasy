export interface Trip {
  id: string;
  userId: string;
  user_id?: string; // For compatibility with backend
  name: string;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
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
  status: 'draft' | 'planned' | 'completed' | 'cancelled';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  stops: TripStop[];
}

export interface TripStop {
  id: string;
  tripId: string;
  resortId?: string;
  resort_id?: string;
  stopOrder: number;
  checkIn: string; // ISO date string
  checkOut: string; // ISO date string
  notes?: string;
  // For UI state
  isSelected?: boolean;
}

export interface Resort {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  amenities?: {
    [key: string]: boolean | string | number;
  };
  phone?: string;
  website?: string;
}

export interface UserPreferences {
  vehicle: {
    type: 'motorhome' | 'trailer' | 'fifth_wheel' | 'van' | 'other';
    length: number; // in feet
    height?: number; // in feet
    width?: number; // in feet
    hasSlideouts?: boolean;
  };
  hookups: {
    water: boolean;
    electric: boolean;
    sewer: boolean;
    cable?: boolean;
    wifi?: boolean;
  };
  scenery: {
    coast: number; // 0-5 preference rating
    mountains: number;
    forest: number;
    riverside: number;
    desert: number;
  };
  dailyDriveLimit: number; // in hours
  costPreference: {
    min: number;
    max: number;
  };
  pets: {
    dogs?: number;
    cats?: number;
    other?: boolean;
  };
}

// This interface is no longer needed since Trip now includes stops
// export interface TripWithStops extends Trip {
//   stops?: TripStop[];
// } 