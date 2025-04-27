import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

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

const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // TEMPORARY FOR TESTING: Set isGuest to true by default
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // TEMPORARY FOR TESTING: Short-circuit and set guest mode
        setIsLoading(false);
        setIsGuest(true);
        // Add a placeholder user for testing
        setUser({
          id: 'guest-user-id',
          email: 'guest@example.com',
          fullName: 'Guest User'
        });
        await AsyncStorage.setItem('guest_mode', 'true');
        console.log('⚠️ TESTING MODE: Automatically using guest mode');
        return;

        // Original authentication code (currently bypassed)
        /*
        setIsLoading(true);
        
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setSession(session);
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name,
          });
          setIsAuthenticated(true);
        } else {
          // Check if guest mode is active
          const guestMode = await AsyncStorage.getItem('guest_mode');
          if (guestMode === 'true') {
            setIsGuest(true);
          }
        }
        */
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Skip auth subscription for testing
    return () => {
      // No cleanup needed in test mode
    };

    /*
    // Original auth subscription (currently bypassed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setSession(session);
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name,
          });
          setIsAuthenticated(true);
          setIsGuest(false);
        } else {
          setSession(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
    */
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Sign in failed') 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { success: false, error };
      }

      // Create user profile
      if (data.user) {
        await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            full_name: fullName,
            is_guest: false,
          });
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Sign up failed') 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error };
      }

      setIsGuest(false);
      await AsyncStorage.removeItem('guest_mode');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Sign out failed') 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Continue as guest
  const continueAsGuest = useCallback(async () => {
    try {
      setIsLoading(true);
      await AsyncStorage.setItem('guest_mode', 'true');
      setIsGuest(true);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Guest mode failed') 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  // Sign in with Facebook
  const signInWithFacebook = useCallback(async () => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    isGuest,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    resetPassword,
  };
};

export default useAuth; 