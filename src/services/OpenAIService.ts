import axios from 'axios';
import { Coordinate } from './MapsService';

// Types
export interface SceneryPreference {
  coast: boolean;
  mountains: boolean;
  forests: boolean;
  rivers: boolean;
}

export interface ResortPreference {
  rvLength: string;
  trailerLength?: string;
  hasPets: boolean;
  costPreference: string;
  hookupNeeds: string;
  sceneryPriorities: SceneryPreference;
}

export interface ResortSuggestion {
  id: string;
  name: string;
  location: string;
  address: string;
  coordinates: Coordinate;
  rating: number;
  costPerNight: string;
  distance: string;
  amenities: string[];
  phoneNumber?: string;
  website?: string;
  sceneryScore: number;
  matchReason: string;
  recommendedSites?: string[];
}

class OpenAIService {
  private static instance: OpenAIService;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('OpenAI API key is missing. AI-driven features will not work.');
    }
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Generate resort suggestions based on user preferences and nearby places
   */
  async suggestResorts(
    userPreferences: ResortPreference,
    nearbyPlaces: any[],
    currentLocation: string,
    nextLocation: string
  ): Promise<ResortSuggestion[]> {
    try {
      if (!this.apiKey) {
        console.error('OpenAI API key is missing');
        return this.fallbackSuggestions(nearbyPlaces);
      }

      // Format the nearby places into a condensed representation
      const placesData = nearbyPlaces.map(place => ({
        name: place.name,
        address: place.vicinity || place.formatted_address,
        location: place.geometry.location,
        rating: place.rating,
        types: place.types,
        amenities: this.extractAmenities(place),
        cost_level: place.price_level,
        website: place.website,
        phone: place.international_phone_number || place.formatted_phone_number
      }));

      // Create prompt for GPT-4
      const prompt = this.buildResortPrompt(userPreferences, placesData, currentLocation, nextLocation);

      // Call OpenAI API
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful RV travel assistant that provides resort and campground recommendations based on user preferences and available options.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Parse OpenAI response
      const content = response.data.choices[0].message.content;
      
      try {
        const parsedResponse = JSON.parse(content);
        
        if (Array.isArray(parsedResponse.suggestions)) {
          return parsedResponse.suggestions;
        }
        
        return this.fallbackSuggestions(nearbyPlaces);
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        return this.fallbackSuggestions(nearbyPlaces);
      }
    } catch (error) {
      console.error('Error getting resort suggestions from OpenAI:', error);
      return this.fallbackSuggestions(nearbyPlaces);
    }
  }

  /**
   * Build detailed prompt for OpenAI
   */
  private buildResortPrompt(
    preferences: ResortPreference,
    places: any[],
    currentLocation: string,
    nextLocation: string
  ): string {
    const sceneryPrefs = Object.entries(preferences.sceneryPriorities)
      .filter(([_, value]) => value)
      .map(([key]) => key)
      .join(', ');

    return `
I need recommendations for RV resorts or campgrounds for a trip from ${currentLocation} to ${nextLocation}.

USER PREFERENCES:
- RV Length: ${preferences.rvLength}
- ${preferences.trailerLength ? `Trailer Length: ${preferences.trailerLength}` : 'No trailer'}
- ${preferences.hasPets ? 'Has pets' : 'No pets'}
- Price Range: ${preferences.costPreference}
- Hookup Needs: ${preferences.hookupNeeds}
- Scenery Priorities: ${sceneryPrefs || 'No specific preferences'}

AVAILABLE OPTIONS:
${JSON.stringify(places, null, 2)}

Based on these options and preferences, suggest the top 3-5 resorts or campgrounds that would be most suitable.
For each suggestion, provide:
1. Name and location
2. Distance from current location
3. Price per night (estimate if not available)
4. Rating
5. Key amenities that match the user's needs
6. Whether it accommodates the RV size
7. A brief reason why this is a good match (focusing on scenery preferences)
8. Recommended site numbers (if available)

Format your response as a JSON object with an array of suggestions in the following structure:
{
  "suggestions": [
    {
      "id": "unique-id-1",
      "name": "Resort Name",
      "location": "City, State",
      "address": "Full address",
      "coordinates": { "latitude": 00.000, "longitude": 00.000 },
      "rating": 4.5,
      "costPerNight": "$45",
      "distance": "125 miles",
      "amenities": ["Full Hookups", "WiFi", "Pool"],
      "phoneNumber": "(555) 123-4567",
      "website": "https://example.com",
      "sceneryScore": 95,
      "matchReason": "Nestled in the mountains with forest views, exactly matching the user's scenery preferences",
      "recommendedSites": ["A42", "B17"]
    }
  ]
}
`;
  }

  /**
   * Fallback suggestion generator when API fails
   */
  private fallbackSuggestions(nearbyPlaces: any[]): ResortSuggestion[] {
    // Simple algorithm to rank places if AI fails
    const suggestions: ResortSuggestion[] = [];
    
    for (let i = 0; i < Math.min(nearbyPlaces.length, 5); i++) {
      const place = nearbyPlaces[i];
      
      suggestions.push({
        id: `fallback-${i}`,
        name: place.name,
        location: place.vicinity || place.formatted_address || 'Unknown location',
        address: place.formatted_address || place.vicinity || 'Unknown address',
        coordinates: {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng
        },
        rating: place.rating || 3.0,
        costPerNight: this.estimateCost(place),
        distance: 'Unknown',
        amenities: this.extractAmenities(place),
        phoneNumber: place.formatted_phone_number,
        website: place.website,
        sceneryScore: 50,
        matchReason: 'This option is located near your route.',
        recommendedSites: []
      });
    }
    
    return suggestions;
  }

  /**
   * Extract amenities from place data
   */
  private extractAmenities(place: any): string[] {
    const amenities: string[] = [];
    
    if (place.types && Array.isArray(place.types)) {
      if (place.types.includes('campground')) {
        amenities.push('Campground');
      }
      if (place.types.includes('rv_park')) {
        amenities.push('RV Park');
      }
      if (place.types.includes('lodging')) {
        amenities.push('Lodging');
      }
    }
    
    // Add more amenities based on reviews or other data
    if (place.business_status === 'OPERATIONAL') {
      amenities.push('Open for Business');
    }
    
    if (place.rating && place.rating >= 4) {
      amenities.push('Highly Rated');
    }
    
    return amenities;
  }

  /**
   * Estimate cost based on available data
   */
  private estimateCost(place: any): string {
    if (place.price_level) {
      // Convert Google's price levels (0-4) to dollar amounts
      const prices = ['$25', '$35', '$45', '$60', '$80'];
      return prices[Math.min(place.price_level, 4)];
    }
    
    // Default estimate
    return '$45';
  }

  /**
   * Process user preferences in natural language
   */
  async processNaturalLanguagePreferences(text: string): Promise<Partial<ResortPreference>> {
    try {
      if (!this.apiKey) {
        console.error('OpenAI API key is missing');
        return {};
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful RV travel assistant. Extract RV travel preferences from user input.'
            },
            {
              role: 'user',
              content: `Extract RV travel preferences from this text: "${text}". 
                Identify: RV length, trailer details, pets, cost preference, hookup needs, and scenery priorities (coast, mountains, forests, rivers).
                Reply with JSON only.`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Error parsing preferences:', parseError);
        return {};
      }
    } catch (error) {
      console.error('Error processing natural language preferences:', error);
      return {};
    }
  }
}

export default OpenAIService.getInstance(); // Export singleton instance 