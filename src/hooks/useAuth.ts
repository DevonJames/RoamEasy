import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import SupabaseService from '../services/SupabaseService';
import { AuthSession } from '@supabase/supabase-js';

// Use environment variables
const supabaseUrl = SUPABASE_URL || '';
const supabaseAnonKey = SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

export interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
}

const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Load user on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        
        // TEMPORARY: Set a mock authenticated user for testing
        // In a real app, this would be:
        // const session = await SupabaseService.getSession();
        
        // Mock session for testing
        const mockUser = {
          id: 'test-user-id-123',
          email: 'test@example.com',
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: 'Test User' },
          created_at: new Date().toISOString()
        } as User;
        
        const mockSession = {
          user: mockUser,
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_at: Date.now() + 3600 * 1000 // 1 hour
        } as AuthSession;
        
        setState({
          user: mockUser,
          session: mockSession,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // Listen for auth state changes in a real implementation
        // const { data: authListener } = SupabaseService.onAuthStateChange((event, session) => {
        //   setState(prev => ({
        //     ...prev,
        //     user: session?.user || null,
        //     session,
        //     isAuthenticated: !!session?.user,
        //   }));
        // });
        
        // return () => {
        //   authListener?.unsubscribe();
        // };
      } catch (error) {
        setState({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          error: error as Error,
        });
      }
    };

    fetchSession();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // In real implementation:
      // const result = await SupabaseService.signIn(email, password);
      // if (result.error) throw result.error;
      
      // For testing just return success
      console.log('Sign in called with:', email, password);
      
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // In real implementation:
      // const result = await SupabaseService.signUp(email, password);
      // if (result.error) throw result.error;
      
      // For testing just return success
      console.log('Sign up called with:', email, password);
      
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // In real implementation:
      // await SupabaseService.signOut();
      
      // For testing, just reset state
      setState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, []);

  // Continue as guest
  const continueAsGuest = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await AsyncStorage.setItem('guest_mode', 'true');
      setState(prev => ({ ...prev, isAuthenticated: false, user: null, session: null }));
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Guest mode failed') 
      };
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });

      if (error) {
        return { success: false, error };
      }

      return { success: true, url: data.url };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Google sign in failed') 
      };
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
      });

      if (error) {
        return { success: false, error };
      }

      return { success: true, url: data.url };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Apple sign in failed') 
      };
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Sign in with Facebook
  const signInWithFacebook = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
      });

      if (error) {
        return { success: false, error };
      }

      return { success: true, url: data.url };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Facebook sign in failed') 
      };
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'roameasy://reset-password',
      });

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Password reset failed') 
      };
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  return {
    ...state,
    continueAsGuest,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    resetPassword,
  };
};

export default useAuth; 