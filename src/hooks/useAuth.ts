import { useState, useEffect, useCallback, useRef } from 'react';
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
  isGuest: boolean;
  hasSignedUp?: boolean;
}

// Helper function to check if two auth states are meaningfully different
function areAuthStatesEqual(stateA: AuthState, stateB: AuthState): boolean {
  try {
    // Handle null or undefined states
    if (!stateA || !stateB) return false;
    
    // Only compare relevant authentication properties
    return (
      stateA.isAuthenticated === stateB.isAuthenticated &&
      stateA.isGuest === stateB.isGuest &&
      // Only compare user IDs, not the entire user object
      ((stateA.user === null && stateB.user === null) || 
       (stateA.user !== null && stateB.user !== null && 
        stateA.user.id === stateB.user.id))
    );
  } catch (error) {
    console.error('Error comparing auth states:', error);
    // When in doubt, assume states are different
    return false;
  }
}

const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    isGuest: false
  });
  
  // Keep a ref of the current state to prevent updates to identical states
  const stateRef = useRef<AuthState>(state);

  // Safe state update function that only updates if there's an actual change
  const safeSetState = useCallback((newState: AuthState | ((prev: AuthState) => AuthState)) => {
    try {
      setState(prev => {
        try {
          // Handle function updater pattern
          const nextState = typeof newState === 'function' ? newState(prev) : newState;
          
          // Only update if there's a meaningful change
          if (!areAuthStatesEqual(stateRef.current, nextState)) {
            // Update the ref
            stateRef.current = nextState;
            return nextState;
          }
          
          // No meaningful change, return previous state
          return prev;
        } catch (error) {
          console.error('Error in safeSetState inner try:', error);
          // On error, just update state to be safe
          return typeof newState === 'function' ? newState(prev) : newState;
        }
      });
    } catch (error) {
      console.error('Error in safeSetState outer try:', error);
      // Fall back to regular setState in case of errors
      setState(typeof newState === 'function' 
        ? (prev => (newState as (prev: AuthState) => AuthState)(prev)) 
        : newState);
    }
  }, []);

  // Load user on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        safeSetState(prev => ({ ...prev, isLoading: true }));
        
        // Check if user is in guest mode
        const guestMode = await AsyncStorage.getItem('guest_mode');
        const isGuest = guestMode === 'true';
        
        // Create a new state object
        const newState = {
          user: null,
          session: null,
          isAuthenticated: false,
          isGuest,
          isLoading: false,
          error: null,
        };
        
        // Explicitly update the stateRef first to avoid comparison issues
        stateRef.current = newState;
        
        // Then update the state
        setState(newState);
        
        // Log initialization success
        console.log('Auth initialized:', { isGuest });
        
        // In a real app, we'd listen for auth state changes:
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
        console.error('Error initializing auth:', error);
        
        // Create a fallback state
        const fallbackState = {
          user: null,
          session: null,
          isAuthenticated: false,
          isGuest: false,
          isLoading: false,
          error: error as Error,
        };
        
        // Update the ref directly
        stateRef.current = fallbackState;
        
        // Update the state directly
        setState(fallbackState);
      }
    };

    // Run immediate initialization
    console.log('Auth hook initializing...');
    fetchSession();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Use the actual Supabase service
      const result = await SupabaseService.signIn(email, password);
      if (result.error) throw result.error;
      
      // Update state with user info
      if (result.user) {
        safeSetState(prev => ({
          ...prev,
          user: result.user as unknown as User,
          isAuthenticated: true,
          isLoading: false,
          isGuest: false
        }));
        return { success: true };
      } else {
        throw new Error('Sign in failed - no user returned');
      }
    } catch (error) {
      safeSetState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, [safeSetState]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Use the actual Supabase service
      const result = await SupabaseService.signUp(email, password);
      if (result.error) throw result.error;
      
      // Update profile with full name if provided
      if (result.user && fullName) {
        try {
          await SupabaseService.updateProfile(result.user.id, { full_name: fullName });
        } catch (profileError) {
          console.error('Failed to update profile:', profileError);
          // Continue anyway as the user was created successfully
        }
      }
      
      // Update state with user info - FORCE a state change that will trigger navigation
      if (result.user) {
        console.log('SIGNUP SUCCESS - Updating auth state to authenticated', result.user.id);
        
        // Create a new state object and directly update both state and ref
        const newAuthState = {
          user: result.user as unknown as User,
          session: null, // We don't have a session yet
          isAuthenticated: true, // This is the key part for navigation
          isLoading: false,
          error: null,
          isGuest: false,
          hasSignedUp: true
        };
        
        // Update the ref directly first
        stateRef.current = newAuthState;
        
        // Then update the state
        setState(newAuthState);
        
        console.log('Auth state updated after signup:', { isAuthenticated: true, userId: result.user.id });
        return { success: true };
      } else {
        throw new Error('Sign up failed - no user returned');
      }
    } catch (error) {
      console.error('Signup error:', error);
      safeSetState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, [safeSetState]);

  const signOut = useCallback(async () => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Use the actual Supabase service
      const result = await SupabaseService.signOut();
      if (result.error) throw result.error;
      
      // Clear guest mode from AsyncStorage
      await AsyncStorage.removeItem('guest_mode');
      
      // Reset state
      safeSetState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isGuest: false
      });
      
      return { success: true };
    } catch (error) {
      safeSetState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, [safeSetState]);

  // Continue as guest
  const continueAsGuest = useCallback(async () => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true }));
      await AsyncStorage.setItem('guest_mode', 'true');
      safeSetState(prev => ({ 
        ...prev, 
        isAuthenticated: false,
        isGuest: true,
        user: null, 
        session: null 
      }));
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Guest mode failed') 
      };
    } finally {
      safeSetState(prev => ({ ...prev, isLoading: false }));
    }
  }, [safeSetState]);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true }));
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
      safeSetState(prev => ({ ...prev, isLoading: false }));
    }
  }, [safeSetState]);

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true }));
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
      safeSetState(prev => ({ ...prev, isLoading: false }));
    }
  }, [safeSetState]);

  // Sign in with Facebook
  const signInWithFacebook = useCallback(async () => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true }));
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
      safeSetState(prev => ({ ...prev, isLoading: false }));
    }
  }, [safeSetState]);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true }));
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
      safeSetState(prev => ({ ...prev, isLoading: false }));
    }
  }, [safeSetState]);

  return {
    ...state,
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