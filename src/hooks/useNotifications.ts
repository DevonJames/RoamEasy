import { useState, useCallback, useEffect } from 'react';
import NotificationService from '../services/NotificationService';
import useAuth from './useAuth';

export interface Notification {
  id: string;
  tripId: string;
  title: string;
  body: string;
  scheduledTime: Date;
  sent: boolean;
}

export interface NotificationParams {
  tripId: string;
  title: string;
  body: string;
  scheduledTime: Date;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  // Fetch all upcoming notifications for the current user
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await NotificationService.getNotifications(user.id);
      setNotifications(result);
      setIsLoading(false);
      return { success: true, notifications: result };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, [user]);

  // Schedule a new notification
  const scheduleNotification = useCallback(async (params: NotificationParams) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await NotificationService.scheduleNotification({
        userId: user.id,
        tripId: params.tripId,
        title: params.title,
        body: params.body,
        scheduledTime: params.scheduledTime,
      });
      
      setNotifications(prev => [...prev, result]);
      setIsLoading(false);
      return { success: true, notification: result };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, [user]);

  // Schedule departure reminders based on trip stops and prep time
  const scheduleDepartureReminders = useCallback(async (
    tripId: string, 
    stops: Array<{ 
      id: string, 
      checkOutDate: Date, 
      resortName: string 
    }>, 
    prepTimeMinutes: number
  ) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await NotificationService.scheduleDepartureReminders(
        user.id,
        tripId,
        stops,
        prepTimeMinutes
      );
      
      setNotifications(prev => [...prev, ...results]);
      setIsLoading(false);
      return { success: true, notifications: results };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, [user]);

  // Cancel a notification by ID
  const cancelNotification = useCallback(async (notificationId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await NotificationService.cancelNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Cancel all notifications for a trip
  const cancelTripNotifications = useCallback(async (tripId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await NotificationService.cancelTripNotifications(tripId);
      setNotifications(prev => prev.filter(n => n.tripId !== tripId));
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      return { success: false, error: err as Error };
    }
  }, []);

  // Request notification permissions if needed
  const requestPermissions = useCallback(async () => {
    try {
      const granted = await NotificationService.requestPermissions();
      return { success: true, granted };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  }, []);

  // Load notifications when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    scheduleNotification,
    scheduleDepartureReminders,
    cancelNotification,
    cancelTripNotifications,
    requestPermissions,
  };
}

export default useNotifications; 