import {
  GOOGLE_MAPS_API_KEY as MAPS_KEY,
  OPENAI_API_KEY as AI_KEY,
  OPENROUTE_SERVICE_API_KEY as ORS_KEY,
  SUPABASE_URL as SUPABASE_URL_ENV,
  SUPABASE_ANON_KEY as SUPABASE_KEY_ENV
} from '@env';

// Environment variables with fallbacks
export const GOOGLE_MAPS_API_KEY = MAPS_KEY || '';
export const OPENAI_API_KEY = AI_KEY || '';
export const OPENROUTE_SERVICE_API_KEY = ORS_KEY || '';
export const SUPABASE_URL = SUPABASE_URL_ENV || '';
export const SUPABASE_ANON_KEY = SUPABASE_KEY_ENV || '';

// Validate required environment variables
export const validateEnvironment = (): { isValid: boolean; missing: string[] } => {
  const required = {
    GOOGLE_MAPS_API_KEY,
    OPENAI_API_KEY,
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  };
  
  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
    
  return {
    isValid: missing.length === 0,
    missing
  };
};

export default {
  GOOGLE_MAPS_API_KEY,
  OPENAI_API_KEY,
  OPENROUTE_SERVICE_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  validateEnvironment
}; 