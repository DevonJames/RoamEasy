import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import Logo from '../assets/logo';

// Define theme colors
const COLORS = {
  primary: '#2E7D32',
  secondary: '#FF7043',
  text: '#333333',
  error: '#D32F2F',
  background: '#F5F5F5',
  link: '#2E7D32',
  gray: '#757575',
  divider: '#E0E0E0',
  white: '#FFFFFF',
};

// Define navigation types
type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  GuestMode: undefined;
  Main: undefined;
  ForgotPassword: undefined;
};

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList>;

const SignInScreen = React.memo(() => {
  // Use ref to track if component is mounted
  const isMounted = useRef(true);
  const passwordBuffer = useRef('');
  const navigation = useNavigation<SignInScreenNavigationProp>();
  
  // Get auth functions but NOT state to prevent unnecessary re-renders
  const { signIn, signInWithGoogle, signInWithApple, signInWithFacebook, continueAsGuest } = useAuth();

  // Form state - keep local to prevent global state changes
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayPassword, setDisplayPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug logging
  useEffect(() => {
    console.log('SignInScreen mounted, setting up');

    return () => {
      console.log('SignInScreen unmounted, cleaning up');
      isMounted.current = false;
    };
  }, []);
  
  // Track password changes in a buffer first to prevent frequent state updates
  const handlePasswordChange = (text: string) => {
    if (!isMounted.current) return;
    
    // Update display value immediately for responsive UI
    setDisplayPassword(text);
    
    // Use the buffer to avoid state updates
    passwordBuffer.current = text;
    
    // Only update state after typing stops for better performance
    setTimeout(() => {
      if (isMounted.current && passwordBuffer.current === text) {
        setPassword(text);
      }
    }, 300);
  };

  const handleSignIn = async () => {
    console.log('Sign in button pressed');
    setError(null);
    setIsLoading(true);

    // Get latest value from buffer
    const currentPassword = passwordBuffer.current || password;

    // Basic validation
    if (!email || !currentPassword) {
      setError('Please enter both email and password');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Calling signIn function with:', { email, passwordLength: currentPassword.length });
      const result = await signIn(email, currentPassword);
      console.log('Sign in result:', result);
      
      if (!result.success && result.error) {
        setError(result.error.message);
      } else {
        // Success! Navigation will be handled by AppNavigator
        console.log('Sign in successful!');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleForgotPassword = () => {
    console.log('Forgot password pressed');
    // TODO: Implement forgot password functionality
    Alert.alert(
      'Reset Password',
      'Please enter your email address to receive a password reset link.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send Link',
          onPress: () => {
            // TODO: Call the reset password API
            Alert.alert('Password Reset Link Sent', 'Please check your email for instructions to reset your password.');
          },
        },
      ]
    );
  };

  const handleGoogleSignIn = async () => {
    console.log('Google sign in pressed');
    setError(null);
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      console.log('Google sign in result:', result);
      
      if (!result.success && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleAppleSignIn = async () => {
    console.log('Apple sign in pressed');
    setError(null);
    setIsLoading(true);
    try {
      const result = await signInWithApple();
      console.log('Apple sign in result:', result);
      
      if (!result.success && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      console.error('Apple sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with Apple. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleFacebookSignIn = async () => {
    console.log('Facebook sign in pressed');
    setError(null);
    setIsLoading(true);
    try {
      const result = await signInWithFacebook();
      console.log('Facebook sign in result:', result);
      
      if (!result.success && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      console.error('Facebook sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with Facebook. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleGuestMode = async () => {
    console.log('Guest mode pressed');
    setError(null);
    setIsLoading(true);
    try {
      const result = await continueAsGuest();
      console.log('Guest mode result:', result);
      
      if (!result.success && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      console.error('Guest mode error:', err);
      setError(err instanceof Error ? err.message : 'Failed to continue as guest. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo and Header */}
        <View style={styles.header}>
          <Logo size={60} color={COLORS.primary} />
          <Text style={styles.appName}>RoamEasy</Text>
          <Text style={styles.tagline}>Sign in to your account</Text>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Simple Form */}
        <View style={styles.formContainer}>
          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={24} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., john@example.com"
              value={email}
              onChangeText={text => isMounted.current && setEmail(text)}
              autoCapitalize="none"
              keyboardType="email-address"
              testID="emailInput"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={24} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={displayPassword}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              textContentType="oneTimeCode"
              keyboardType={showPassword ? "visible-password" : "default"}
              testID="passwordInput"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color={COLORS.gray} 
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotPasswordContainer} 
            onPress={handleForgotPassword}
            testID="forgotPasswordButton"
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.disabledButton]} 
            onPress={handleSignIn}
            disabled={isLoading}
            testID="signInButton"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Social Sign In */}
          <View style={styles.orContainer}>
            <View style={styles.divider} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialButtonsContainer}>
            {/* Google */}
            <TouchableOpacity 
              style={styles.socialButton} 
              onPress={handleGoogleSignIn}
              testID="googleSignInButton"
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity 
              style={styles.socialButton} 
              onPress={handleAppleSignIn}
              testID="appleSignInButton"
            >
              <Ionicons name="logo-apple" size={24} color="#000000" />
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity 
              style={styles.socialButton} 
              onPress={handleFacebookSignIn}
              testID="facebookSignInButton"
            >
              <Ionicons name="logo-facebook" size={24} color="#4267B2" />
              <Text style={styles.socialButtonText}>Facebook</Text>
            </TouchableOpacity>
          </View>

          {/* Guest Mode */}
          <TouchableOpacity 
            style={styles.guestButton} 
            onPress={handleGuestMode}
            testID="guestModeButton"
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => {
              console.log('Navigate to Sign Up');
              navigation.navigate('SignUp');
            }}>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 5,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: COLORS.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: COLORS.link,
    fontSize: 14,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  orText: {
    color: COLORS.gray,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginHorizontal: 4,
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  guestButton: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  guestButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: 16,
    color: COLORS.text,
  },
  link: {
    color: COLORS.link,
    fontWeight: 'bold',
    fontSize: 16,
  },
  passwordToggle: {
    padding: 8,
  },
});

export default SignInScreen; 