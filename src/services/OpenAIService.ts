import axios from 'axios';
import { OPENAI_API_KEY } from '../utils/environment';
import { Coordinates } from './MapsService';

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
  coordinates: Coordinates;
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
    this.apiKey = OPENAI_API_KEY || '';
    
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

  /**
   * Optimize a route based on user preferences and driving constraints
   */
  async optimizeRoute(params: {
    route: RouteResult;
    maxDriveTimeHours: number;
    sceneryPreferences: SceneryPreference;
  }): Promise<{ stops: Location[] | null; error: Error | null }> {
    try {
      const { route, maxDriveTimeHours, sceneryPreferences } = params;

      // For testing purposes, we'll create some sample stops 
      // This would normally make a call to OpenAI to get smart stop suggestions
      console.log('Optimizing route with OpenAI...');
      
      // Create stops based on the route
      const totalDistance = route.totalDistance;
      const totalDuration = route.totalDuration;
      
      // Calculate how many stops we need based on max drive time
      // Convert seconds to hours for calculation
      const totalDriveHours = totalDuration / 3600;
      const numberOfStops = Math.ceil(totalDriveHours / maxDriveTimeHours);
      
      console.log(`Route info: ${totalDistance}m, ${totalDriveHours}hrs`);
      console.log(`Creating ${numberOfStops} stops with max ${maxDriveTimeHours}hrs driving per day`);
      
      // Create evenly spaced stops
      const stops: Location[] = [];
      
      // Always include start location
      const startLocation: Location = {
        coordinates: {
          latitude: route.waypoints[0].coordinates.latitude,
          longitude: route.waypoints[0].coordinates.longitude
        },
        address: route.waypoints[0].address
      };
      stops.push(startLocation);
      
      // If we need intermediate stops
      if (numberOfStops > 1) {
        const routeSegments = this.divideRouteIntoSegments(route, numberOfStops);
        
        for (let i = 1; i < routeSegments.length; i++) {
          const segment = routeSegments[i];
          const stopLocation: Location = {
            coordinates: {
              latitude: segment.endLocation.coordinates.latitude,
              longitude: segment.endLocation.coordinates.longitude
            },
            address: segment.endLocation.address
          };
          stops.push(stopLocation);
        }
      }
      
      // Always include end location if not already included
      const endLocation: Location = {
        coordinates: {
          latitude: route.waypoints[route.waypoints.length - 1].coordinates.latitude,
          longitude: route.waypoints[route.waypoints.length - 1].coordinates.longitude
        },
        address: route.waypoints[route.waypoints.length - 1].address
      };
      
      // Only add end location if it's not already the last stop
      if (stops.length === 0 || 
          stops[stops.length - 1].coordinates.latitude !== endLocation.coordinates.latitude ||
          stops[stops.length - 1].coordinates.longitude !== endLocation.coordinates.longitude) {
        stops.push(endLocation);
      }
      
      console.log('Generated stops:', stops);
      
      // Ensure all stops have valid coordinates
      const validStops = stops.filter(stop => 
        stop && 
        stop.coordinates && 
        typeof stop.coordinates.latitude === 'number' && 
        typeof stop.coordinates.longitude === 'number'
      );
      
      console.log('OpenAIService: Returning validStops:', validStops.length);
      
      // IMPORTANT: Make absolutely sure we're not returning an empty array if we have stops
      if (validStops.length === 0 && stops.length > 0) {
        console.warn('WARNING: All stops were filtered out due to invalid coordinates. Using original stops.');
        return { stops: stops, error: null };
      }
      
      return { stops: validStops, error: null };
    } catch (error) {
      console.error('Error optimizing route:', error);
      return { stops: null, error: error as Error };
    }
  }
  
  // Helper method to divide a route into segments
  private divideRouteIntoSegments(route: RouteResult, numberOfSegments: number): RouteSegment[] {
    console.log(`Dividing route into ${numberOfSegments} segments`);
    
    const totalDuration = route.totalDuration;
    const durationPerSegment = totalDuration / numberOfSegments;
    
    console.log(`Total duration: ${totalDuration}s, Duration per segment: ${durationPerSegment}s`);
    
    const segments: RouteSegment[] = [];
    let currentDuration = 0;
    let currentSegmentIndex = 0;
    
    // Add start point as first segment
    segments.push({
      legIndex: 0,
      startLocation: route.waypoints[0],
      endLocation: route.waypoints[0],
      distance: 0,
      duration: 0,
      polyline: ''
    });
    
    // We need to create numberOfSegments-1 intermediate points
    // (start and end points are already accounted for)
    const intermediatePoints = numberOfSegments - 1;
    
    if (intermediatePoints <= 0) {
      // If no intermediate points needed, just add the end location
      segments.push({
        legIndex: route.legs.length - 1,
        startLocation: route.waypoints[0],
        endLocation: route.waypoints[route.waypoints.length - 1],
        distance: route.totalDistance,
        duration: route.totalDuration,
        polyline: ''
      });
      
      return segments;
    }
    
    // For each intermediate segment, calculate its endpoint
    for (let i = 1; i <= intermediatePoints; i++) {
      const targetDuration = (i * totalDuration) / numberOfSegments;
      console.log(`Targeting duration for segment ${i}: ${targetDuration}s`);
      
      // Find the leg and position within the leg for this segment endpoint
      let accumulatedDuration = 0;
      let targetLegIndex = -1;
      let fractionOfLeg = 0;
      
      for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
        const leg = route.legs[legIndex];
        
        if (accumulatedDuration + leg.duration > targetDuration) {
          // This leg contains our target point
          targetLegIndex = legIndex;
          fractionOfLeg = (targetDuration - accumulatedDuration) / leg.duration;
          break;
        }
        
        accumulatedDuration += leg.duration;
      }
      
      if (targetLegIndex === -1) {
        // If we couldn't find the right leg, use the last one
        targetLegIndex = route.legs.length - 1;
        fractionOfLeg = 1.0;
      }
      
      // Calculate the endpoint for this segment
      const leg = route.legs[targetLegIndex];
      const midpoint = this.interpolateLocation(
        leg.startLocation,
        leg.endLocation,
        fractionOfLeg
      );
      
      console.log(`Created segment endpoint at fraction ${fractionOfLeg} of leg ${targetLegIndex}`);
      
      // Add the segment
      segments.push({
        legIndex: targetLegIndex,
        startLocation: segments[segments.length - 1].endLocation,
        endLocation: midpoint,
        distance: (route.totalDistance * i) / numberOfSegments,
        duration: targetDuration - (segments.length > 1 ? segments[segments.length - 1].duration : 0),
        polyline: ''
      });
    }
    
    // Add end point if needed (if it's not already the last stop)
    if (segments.length < numberOfSegments + 1) {
      segments.push({
        legIndex: route.legs.length - 1,
        startLocation: segments[segments.length - 1].endLocation,
        endLocation: route.waypoints[route.waypoints.length - 1],
        distance: route.totalDistance - (segments.length > 1 ? segments[segments.length - 1].distance : 0),
        duration: route.totalDuration - (segments.length > 1 ? segments[segments.length - 1].duration : 0),
        polyline: ''
      });
    }
    
    console.log(`Created ${segments.length} segments total`);
    return segments;
  }
  
  // Helper to interpolate between two locations
  private interpolateLocation(start: Location, end: Location, fraction: number): Location {
    return {
      coordinates: {
        latitude: start.coordinates.latitude + (end.coordinates.latitude - start.coordinates.latitude) * fraction,
        longitude: start.coordinates.longitude + (end.coordinates.longitude - start.coordinates.longitude) * fraction
      },
      address: `Location between ${start.address} and ${end.address}`
    };
  }
}

// Export singleton instance
const openAIServiceInstance = OpenAIService.getInstance();
export default openAIServiceInstance; 