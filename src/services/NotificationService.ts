import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';

// Types
export interface NotificationConfig {
  prepTime: number; // minutes
  checkOutTime: string; // HH:MM format
}

export interface TripStop {
  id: string;
  name: string;
  departureDate: string; // YYYY-MM-DD
  notificationId?: string;
}

// Type declarations for PushNotification methods
declare module 'react-native-push-notification' {
  export function configure(options: any): void;
  export function createChannel(channel: any, callback: (created: boolean) => void): void;
  export function requestPermissions(callback: (permissions: any) => void): void;
  export function localNotificationSchedule(notification: any): void;
  export function localNotification(notification: any): void;
  export function cancelLocalNotification(notificationId: string): void;
  export function cancelAllLocalNotifications(): void;
  export function getScheduledLocalNotifications(callback: (notifications: any[]) => void): void;
}

class NotificationService {
  private static instance: NotificationService;
  private isInitialized: boolean = false;

  private constructor() {
    // Nothing to do - initialization happens in init()
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notifications
   */
  init(): void {
    if (this.isInitialized) return;

    // Configure the notification library
    PushNotification.configure({
      // (required) Called when a remote or local notification is opened or received
      onNotification: (notification: any) => {
        console.log('NOTIFICATION:', notification);
        
        // Required on iOS only (see fetchCompletionHandler docs: https://github.com/react-native-push-notification/ios)
        if (Platform.OS === 'ios') {
          notification.finish('');
        }
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // Required for iOS permissions
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Optional: It's best to have these options on for proper notifications
      requestPermissions: false,
    });

    // Create a notification channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'roameasy-departure-reminders',
          channelName: 'Departure Reminders',
          channelDescription: 'Notifications to remind you about upcoming departures',
          playSound: true,
          soundName: 'default',
          importance: 4, // High importance
          vibrate: true,
        },
        (created: boolean) => console.log(`Notification channel created: ${created}`)
      );
    }

    this.isInitialized = true;
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.requestPermissions((permissions: any) => {
        const granted = permissions && permissions.alert;
        resolve(!!granted);
      });
    });
  }

  /**
   * Schedule a departure reminder
   */
  scheduleDepartureReminder(
    stop: TripStop,
    config: NotificationConfig
  ): string | null {
    try {
      if (!this.isInitialized) {
        this.init();
      }

      // Parse departure date and check-out time
      const dateParts = stop.departureDate.split('-');
      const timeParts = config.checkOutTime.split(':');
      
      if (dateParts.length !== 3 || timeParts.length !== 2) {
        console.error('Invalid date or time format');
        return null;
      }
      
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
      const day = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      
      // Set the departure time
      const departureTime = new Date(year, month, day, hour, minute);
      
      // Calculate notification time by subtracting prep time
      const notificationTime = new Date(departureTime);
      notificationTime.setMinutes(notificationTime.getMinutes() - config.prepTime);
      
      // Skip if the notification time is in the past
      if (notificationTime <= new Date()) {
        console.warn('Skipping notification for past date:', notificationTime);
        return null;
      }
      
      // Create a unique ID for this notification
      const notificationId = `${stop.id}-${Date.now()}`;
      
      // Schedule the notification
      PushNotification.localNotificationSchedule({
        id: notificationId,
        channelId: Platform.OS === 'android' ? 'roameasy-departure-reminders' : undefined,
        title: 'Time to prepare for departure!',
        message: `Start packing for your departure from ${stop.name}. Check-out is at ${config.checkOutTime}.`,
        date: notificationTime,
        allowWhileIdle: true, // Notification will be delivered even if the device is in low-power mode
        playSound: true,
        soundName: 'default',
        userInfo: {
          stopId: stop.id,
          departureDate: stop.departureDate,
        },
      });
      
      return notificationId;
    } catch (error) {
      console.error('Error scheduling departure reminder:', error);
      return null;
    }
  }

  /**
   * Schedule reminders for all stops in a trip
   */
  scheduleAllDepartureReminders(
    stops: TripStop[],
    config: NotificationConfig
  ): Record<string, string | null> {
    const results: Record<string, string | null> = {};
    
    for (const stop of stops) {
      results[stop.id] = this.scheduleDepartureReminder(stop, config);
    }
    
    return results;
  }

  /**
   * Cancel a scheduled notification
   */
  cancelNotification(notificationId: string): void {
    try {
      PushNotification.cancelLocalNotification(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all notifications for a trip
   */
  cancelTripNotifications(notificationIds: string[]): void {
    for (const id of notificationIds) {
      this.cancelNotification(id);
    }
  }

  /**
   * Cancel all RoamEasy notifications
   */
  cancelAllNotifications(): void {
    try {
      PushNotification.cancelAllLocalNotifications();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  getScheduledNotifications(): Promise<any[]> {
    return new Promise((resolve) => {
      PushNotification.getScheduledLocalNotifications((notifications: any[]) => {
        resolve(notifications);
      });
    });
  }

  /**
   * Send an immediate test notification
   */
  sendTestNotification(): void {
    if (!this.isInitialized) {
      this.init();
    }
    
    PushNotification.localNotification({
      channelId: Platform.OS === 'android' ? 'roameasy-departure-reminders' : undefined,
      title: 'RoamEasy Test Notification',
      message: 'This is a test notification from RoamEasy.',
      playSound: true,
      soundName: 'default',
    });
  }
}

export default NotificationService.getInstance(); // Export singleton instance 