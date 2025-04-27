export interface Resort {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  costPerNight: number;
  amenities: Amenities;
  phone?: string;
  website?: string;
  siteNumber?: string;
  images: string[];
  lastUpdated: string; // ISO date string
}

export interface Amenities {
  wifi: boolean;
  power: boolean;
  water: boolean;
  sewer: boolean;
  dumpStation: boolean;
  showers: boolean;
  laundry: boolean;
  pool: boolean;
  petFriendly: boolean;
  rvLength: number; // Maximum RV length in feet
} 