import { Platform, Linking } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import SupabaseService, { Trip, TripStop, Resort } from './SupabaseService';

// Types
export interface CalendarExportOptions {
  includeSiteNumbers: boolean;
  includeCheckInOutTimes: boolean;
  includeNotes: boolean;
  includePhoneNumbers: boolean;
}

export interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  timeZone?: string;
}

export type CalendarServiceType = 'google' | 'apple' | 'ical';

class CalendarServiceClass {
  private static instance: CalendarServiceClass;

  private constructor() {}

  public static getInstance(): CalendarServiceClass {
    if (!CalendarServiceClass.instance) {
      CalendarServiceClass.instance = new CalendarServiceClass();
    }
    return CalendarServiceClass.instance;
  }

  /**
   * Request calendar access permission
   */
  async requestCalendarPermission(): Promise<boolean> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting calendar permission:', error);
      return false;
    }
  }

  /**
   * Export trip to Google Calendar
   */
  async exportToGoogleCalendar(
    trip: Trip,
    stops: TripStop[],
    resorts: Record<string, Resort>,
    options: CalendarExportOptions
  ): Promise<{ success: boolean; eventIds?: string[]; error?: string }> {
    try {
      const hasPermission = await this.requestCalendarPermission();
      
      if (!hasPermission) {
        return { success: false, error: 'Calendar permission denied' };
      }

      // Get available calendars
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      
      // Look for Google calendar
      let googleCalendarId = '';
      
      if (Platform.OS === 'ios') {
        // iOS: find calendar with source.type === 'com.google.calendar'
        const googleCalendar = calendars.find((cal: any) => 
          cal.source && cal.source.type === 'com.google.calendar'
        );
        
        if (googleCalendar) {
          googleCalendarId = googleCalendar.id;
        }
      } else if (Platform.OS === 'android') {
        // Android: find calendar with source.type === 'com.google'
        const googleCalendar = calendars.find((cal: any) => 
          cal.source && cal.source.type === 'com.google'
        );
        
        if (googleCalendar) {
          googleCalendarId = googleCalendar.id;
        }
      }
      
      // If no Google calendar found, try to find default calendar
      if (!googleCalendarId) {
        const defaultCalendar = calendars.find((cal: any) => cal.isDefault);
        
        if (defaultCalendar) {
          googleCalendarId = defaultCalendar.id;
        } else if (calendars.length > 0) {
          // Just use the first available calendar
          googleCalendarId = calendars[0].id;
        } else {
          return { success: false, error: 'No suitable calendar found' };
        }
      }

      // Convert stops to calendar events
      const events = this.stopsToCalendarEvents(trip, stops, resorts, options);
      
      // Create events in calendar
      const eventIds: string[] = [];
      
      for (const event of events) {
        const eventId = await Calendar.createEventAsync(googleCalendarId, {
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          notes: event.notes,
          timeZone: event.timeZone || 'UTC',
          allDay: false,
        });
        
        eventIds.push(eventId);
      }

      // Store event IDs in Supabase for future reference
      if (eventIds.length > 0) {
        await SupabaseService.createCalendarExport(trip.id, 'google', eventIds);
      }
      
      return { success: true, eventIds };
    } catch (error) {
      console.error('Error exporting to Google Calendar:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Export trip to Apple Calendar
   */
  async exportToAppleCalendar(
    trip: Trip,
    stops: TripStop[],
    resorts: Record<string, Resort>,
    options: CalendarExportOptions
  ): Promise<{ success: boolean; eventIds?: string[]; error?: string }> {
    try {
      if (Platform.OS !== 'ios') {
        return { success: false, error: 'Apple Calendar export is only available on iOS' };
      }

      const hasPermission = await this.requestCalendarPermission();
      
      if (!hasPermission) {
        return { success: false, error: 'Calendar permission denied' };
      }

      // Get available calendars
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      
      // Look for iOS calendar
      const iosCalendar = calendars.find((cal: any) => 
        cal.source && cal.source.name === 'iCloud' || cal.source.name === 'Default'
      );
      
      let calendarId = '';
      
      if (iosCalendar) {
        calendarId = iosCalendar.id;
      } else {
        // Try to find default calendar
        const defaultCalendar = calendars.find((cal: any) => cal.isDefault);
        
        if (defaultCalendar) {
          calendarId = defaultCalendar.id;
        } else if (calendars.length > 0) {
          // Just use the first available calendar
          calendarId = calendars[0].id;
        } else {
          return { success: false, error: 'No suitable calendar found' };
        }
      }

      // Convert stops to calendar events
      const events = this.stopsToCalendarEvents(trip, stops, resorts, options);
      
      // Create events in calendar
      const eventIds: string[] = [];
      
      for (const event of events) {
        const eventId = await Calendar.createEventAsync(calendarId, {
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          notes: event.notes,
          timeZone: event.timeZone || 'UTC',
          allDay: false,
        });
        
        eventIds.push(eventId);
      }

      // Store event IDs in Supabase for future reference
      if (eventIds.length > 0) {
        await SupabaseService.createCalendarExport(trip.id, 'apple', eventIds);
      }
      
      return { success: true, eventIds };
    } catch (error) {
      console.error('Error exporting to Apple Calendar:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Export trip to iCal format and share the file
   */
  async exportToICal(
    trip: Trip,
    stops: TripStop[],
    resorts: Record<string, Resort>,
    options: CalendarExportOptions
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Convert stops to calendar events
      const events = this.stopsToCalendarEvents(trip, stops, resorts, options);
      
      // Generate iCal content
      const icalContent = this.generateICalContent(trip, events);
      
      // Save to temporary file
      const fileUri = `${FileSystem.cacheDirectory}${trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.ics`;
      
      await FileSystem.writeAsStringAsync(fileUri, icalContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/calendar',
          dialogTitle: `Share ${trip.name} Calendar`,
          UTI: 'public.calendar',
        });
      } else {
        // On platforms where sharing isn't available, try to open the file with the default app
        await Linking.openURL(fileUri);
      }
      
      // Store export record in Supabase
      await SupabaseService.createCalendarExport(trip.id, 'ical', [fileUri]);
      
      return { success: true, filePath: fileUri };
    } catch (error) {
      console.error('Error exporting to iCal:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete previously exported calendar events
   */
  async deleteCalendarEvents(
    eventIds: string[],
    calendarId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hasPermission = await this.requestCalendarPermission();
      
      if (!hasPermission) {
        return { success: false, error: 'Calendar permission denied' };
      }

      // If no calendar ID provided, try to find the right calendar
      if (!calendarId) {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find((cal: any) => cal.isDefault);
        
        if (defaultCalendar) {
          calendarId = defaultCalendar.id;
        } else if (calendars.length > 0) {
          calendarId = calendars[0].id;
        } else {
          return { success: false, error: 'No suitable calendar found' };
        }
      }

      // Delete each event
      for (const eventId of eventIds) {
        await Calendar.deleteEventAsync(eventId);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting calendar events:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Convert trip stops to calendar events
   */
  private stopsToCalendarEvents(
    trip: Trip,
    stops: TripStop[],
    resorts: Record<string, Resort>,
    options: CalendarExportOptions
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    
    stops.forEach((stop, index) => {
      const resort = resorts[stop.resort_id];
      
      if (!resort) {
        console.warn(`Resort not found for stop: ${stop.id}`);
        return;
      }
      
      // Parse check-in and check-out dates
      const checkInDate = new Date(stop.check_in);
      const checkOutDate = new Date(stop.check_out);
      
      // Construct event title
      let title = `${trip.name} - ${resort.name}`;
      
      // Construct location string
      let location = resort.address;
      
      // Construct notes
      let notes = '';
      
      if (options.includeSiteNumbers && stop.siteNumber) {
        notes += `Site #: ${stop.siteNumber}\n`;
      }
      
      if (options.includePhoneNumbers && resort.phone) {
        notes += `Phone: ${resort.phone}\n`;
      }
      
      if (options.includeNotes && stop.notes) {
        notes += `Notes: ${stop.notes}\n`;
      }
      
      if (resort.website) {
        notes += `Website: ${resort.website}\n`;
      }
      
      notes += `Stop ${index + 1} of ${stops.length} on your RoamEasy trip.`;
      
      events.push({
        title,
        startDate: checkInDate,
        endDate: checkOutDate,
        location,
        notes,
        timeZone: 'UTC',
      });
    });
    
    return events;
  }

  /**
   * Generate iCal file content
   */
  private generateICalContent(trip: Trip, events: CalendarEvent[]): string {
    // Start the iCal file
    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RoamEasy//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${trip.name}`,
      `X-WR-CALDESC:RoamEasy Trip: ${trip.name}`,
    ].join('\r\n');
    
    // Add each event
    for (const event of events) {
      const startDate = this.formatICalDate(event.startDate);
      const endDate = this.formatICalDate(event.endDate);
      
      icalContent += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${Date.now()}${Math.random().toString(36).substring(2, 11)}@roameasy.app`,
        `DTSTAMP:${this.formatICalDate(new Date())}`,
        `DTSTART:${startDate}`,
        `DTEND:${endDate}`,
        `SUMMARY:${event.title}`,
        event.location ? `LOCATION:${this.escapeICalField(event.location)}` : '',
        event.notes ? `DESCRIPTION:${this.escapeICalField(event.notes)}` : '',
        'END:VEVENT',
      ].filter(Boolean).join('\r\n');
    }
    
    // End the iCal file
    icalContent += '\r\nEND:VCALENDAR';
    
    return icalContent;
  }

  /**
   * Format a date for iCal
   */
  private formatICalDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  /**
   * Escape special characters in iCal fields
   */
  private escapeICalField(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}

const CalendarService = CalendarServiceClass.getInstance();
export default CalendarService; 