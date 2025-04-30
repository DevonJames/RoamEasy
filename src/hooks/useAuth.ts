import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User, AuthSession } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import SupabaseService from '../services/SupabaseService';

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
  lastUpdate?: number;
  forceRefresh?: number;
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

  // Get the Supabase client instance from the service
  const supabaseClient = SupabaseService.getClient();

  // Load user on mount
  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));

        // REMOVED OVERRIDE: Hardcode authentication to enable all features
        // const hardcodedUser = {
        //   id: '00000000-1111-2222-3333-444444444444',
        //   email: 'authenticated@user.com',
        //   app_metadata: {},
        //   user_metadata: {},
        //   created_at: new Date().toISOString()
        // };
        // 
        // console.log('HARDCODED AUTHENTICATION ENABLED');
        // setState(prev => ({
        //   ...prev,
        //   user: hardcodedUser as User,
        //   isAuthenticated: true, 
        //   isGuest: false,
        //   isLoading: false
        // }));
        // 
        // return;

        // Restore original logic: Check AsyncStorage and Supabase session
        console.log("Restoring authentication state...");
        const guestMode = await AsyncStorage.getItem('guest_mode');
        
        if (guestMode === 'true') {
          console.log("Found guest mode flag in storage.");
          setState(prev => ({ ...prev, isGuest: true, isAuthenticated: false, user: null, isLoading: false }));
        } else {
          console.log("No guest mode flag found, checking Supabase session.");
          const { data, error } = await SupabaseService.getCurrentUser();
          
          if (error) {
            console.error("Error getting current user:", error);
            setState(prev => ({ ...prev, isAuthenticated: false, user: null, isLoading: false, error }));
          } else if (data?.user) {
            console.log("Found active Supabase session for user:", data.user.id);
            setState(prev => ({ ...prev, isAuthenticated: true, user: data.user, isLoading: false }));
          } else {
            console.log("No active Supabase session found.");
            setState(prev => ({ ...prev, isAuthenticated: false, user: null, isLoading: false }));
          }
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
        setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      }
    };

    restoreAuthState();

    // Listen for Supabase auth changes USING THE SERVICE'S CLIENT
    const { data: authListener } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('[onAuthStateChange] Event:', event);
      console.log('[onAuthStateChange] Session:', session ? `User ID: ${session.user.id}` : 'null');
      
      const user = session?.user ?? null;
      const isAuthenticated = !!user;
      console.log(`[onAuthStateChange] Calculated state: isAuthenticated=${isAuthenticated}, User=${user ? user.id : 'null'}`);
      
      // Always clear guest mode flag if we get an auth event
      try {
        await AsyncStorage.removeItem('guest_mode');
        console.log('[onAuthStateChange] Cleared guest_mode flag.');
      } catch (e) {
        console.error('[onAuthStateChange] Failed to clear guest_mode:', e);
      }
      
      // Capture previous state for comparison
      const prevState = stateRef.current;
      console.log('[onAuthStateChange] Previous state:', { isAuth: prevState.isAuthenticated, userId: prevState.user?.id });

      setState(prev => {
        const newState = { 
          ...prev, 
          user: user ? transformUser(user) : null, 
          session: session, 
          isAuthenticated, 
          isGuest: false, // Explicitly set guest to false on auth change
          isLoading: false,
          error: null 
        };
        console.log('[onAuthStateChange] Attempting to set new state:', { isAuth: newState.isAuthenticated, userId: newState.user?.id });
        return newState;
      });
    });

    return () => {
      // Clean up the listener
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [supabaseClient]);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error: Error | null }> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      console.log('Signing in with email/password...');
      
      // Make sure we clear any guest mode data first
      try {
        await AsyncStorage.removeItem('guest_mode');
        console.log('Cleared guest mode flag during sign in');
      } catch (storageError) {
        console.error('Error clearing guest mode flag:', storageError);
      }
      
      const { user, error } = await SupabaseService.signIn(email, password);

      if (error) {
        console.error('SIGNIN ERROR:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error };
      }

      if (user) {
        console.log('SIGNIN SUCCESS:', user.id);
        
        // Let onAuthStateChange handle state update
        // Force update local storage for auth state - REMOVED - handled by listener
        // try {
        //   await AsyncStorage.setItem('user_authenticated', 'true');
        //   await AsyncStorage.setItem('auth_timestamp', Date.now().toString());
        //   await AsyncStorage.removeItem('guest_mode');
        //   console.log('Updated auth storage flags');
        // } catch (storageError) {
        //   console.error('Error updating auth storage:', storageError);
        // }
        
        // setState(prev => ({
        //   ...prev,
        //   user,
        //   isAuthenticated: true,
        //   isGuest: false,
        //   isLoading: false
        // }));
        
        return { success: true, error: null };
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: new Error('No user returned from sign in') };
    } catch (error) {
      console.error('SIGNIN EXCEPTION:', error);
      setState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  };

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await SupabaseService.signUp(email, password);
      if (result.error) throw result.error;
      
      if (result.user && fullName) {
        try {
          await SupabaseService.updateProfile(result.user.id, { full_name: fullName });
        } catch (profileError) {
          console.error('Failed to update profile:', profileError);
        }
      }
      
      // Let onAuthStateChange handle the state update for SIGNED_IN event
      if (result.user) {
        console.log('SIGNUP SUCCESS - User created:', result.user.id);
        // No direct state update here - listener will handle it.
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
      console.log('Starting sign out process...');
      
      // Immediately update the auth state to trigger navigation
      // Create a new state object for the signed-out state
      const newAuthState = {
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isGuest: false,
        hasSignedUp: false
      };
      
      // Update the ref directly first
      stateRef.current = newAuthState;
      
      // Then update the state directly - NOT using safeSetState
      console.log('Setting auth state to signed out');
      setState(newAuthState);
      
      // Clear guest mode from AsyncStorage
      await AsyncStorage.removeItem('guest_mode');
      
      // Use the actual Supabase service
      const result = await SupabaseService.signOut();
      if (result.error) throw result.error;
      
      return { success: true };
    } catch (error) {
      console.error('Error in signOut:', error);
      safeSetState(prev => ({ ...prev, isLoading: false, error: error as Error }));
      return { success: false, error: error as Error };
    }
  }, []);

  // Continue as guest
  const continueAsGuest = useCallback(async () => {
    try {
      console.log('GUEST MODE - Direct auth state update');
      
      // Set guest mode in AsyncStorage
      await AsyncStorage.setItem('guest_mode', 'true');
      
      // Create a new state object and directly update both state and ref
      const newAuthState = {
        user: null,
        session: null,
        isAuthenticated: false,
        isGuest: true,
        isLoading: false,
        error: null,
        hasSignedUp: false
      };
      
      // Update the ref directly first
      stateRef.current = newAuthState;
      
      // Then update the state directly (bypass safeSetState)
      setState(newAuthState);
      
      console.log('Auth state updated for guest mode:', { isGuest: true });
      return { success: true };
    } catch (error) {
      console.error('Error setting guest mode:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Guest mode failed') 
      };
    }
  }, []);

  // Force refresh auth state
  const forceRefreshAuth = useCallback(async () => {
    try {
      console.log('FORCE REFRESHING AUTH STATE');
      
      // Check if user is in guest mode
      const guestMode = await AsyncStorage.getItem('guest_mode');
      const isGuest = guestMode === 'true';
      
      // Create a new state object with the current guest status
      const newAuthState = {
        user: null,
        session: null,
        isAuthenticated: false,
        isGuest,
        isLoading: false,
        error: null,
        lastUpdate: Date.now() // Force a re-render
      };
      
      // Update the ref directly first
      stateRef.current = newAuthState;
      
      // Then update the state directly
      setState(newAuthState);
      
      console.log('Auth state refreshed:', { isGuest });
      return { success: true };
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Auth refresh failed') 
      };
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    try {
      safeSetState(prev => ({ ...prev, isLoading: true }));
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
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
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
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
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
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
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
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
    forceRefreshAuth
  };
};

// Helper to transform Supabase user to our format
function transformUser(supabaseUser: any): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    // Add other fields as needed
  };
}

export default useAuth; 