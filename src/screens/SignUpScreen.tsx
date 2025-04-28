import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  Alert
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
};

// Define navigation types
type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  GuestMode: undefined;
};

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList>;

// IMPORTANT: This creates a version of the component that won't re-render the entire tree
const SignUpScreen = React.memo(() => {
  // Use ref to track if component is mounted
  const isMounted = useRef(true);
  const passwordInputRef = useRef(null);
  const passwordBuffer = useRef('');
  const confirmPasswordBuffer = useRef('');
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  
  // Get auth functions but NOT state to prevent unnecessary re-renders
  const { signUp } = useAuth();

  // Form state - keep local to prevent global state changes
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayPassword, setDisplayPassword] = useState('');
  const [displayConfirmPassword, setDisplayConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug logging
  useEffect(() => {
    console.log('SignUpScreen mounted, setting up');

    return () => {
      console.log('SignUpScreen unmounted, cleaning up');
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
  
  const handleConfirmPasswordChange = (text: string) => {
    if (!isMounted.current) return;
    
    // Update display value immediately for responsive UI
    setDisplayConfirmPassword(text);
    
    // Use the buffer to avoid state updates
    confirmPasswordBuffer.current = text;
    
    // Only update state after typing stops for better performance
    setTimeout(() => {
      if (isMounted.current && confirmPasswordBuffer.current === text) {
        setConfirmPassword(text);
      }
    }, 300);
  };

  const handleSignUp = async () => {
    console.log('Sign up button pressed');
    setError(null);
    setIsLoading(true);

    // Get latest values from buffers
    const currentPassword = passwordBuffer.current || password;
    const currentConfirmPassword = confirmPasswordBuffer.current || confirmPassword;

    // Basic validation
    if (!fullName || !email || !currentPassword || !currentConfirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (currentPassword !== currentConfirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Simple password validation
    if (currentPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Calling signUp function with:', { email, passwordLength: currentPassword.length });
      const result = await signUp(email, currentPassword, fullName);
      console.log('Sign up result:', result);
      
      if (!result.success && result.error) {
        setError(result.error.message);
      } else {
        // Success! Navigation will be handled by AppNavigator
        console.log('Sign up successful!');
        
        // Show a success alert
        Alert.alert(
          'Success!',
          'Your account has been created successfully. You will now be redirected to the home screen.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign up. Please try again.');
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
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Simple Form */}
        <View style={styles.formContainer}>
          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={24} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., John Doe"
              value={fullName}
              onChangeText={text => isMounted.current && setFullName(text)}
              autoCapitalize="words"
              testID="fullNameInput"
              returnKeyType="next"
            />
          </View>

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
              ref={passwordInputRef}
              style={styles.input}
              placeholder="Minimum 8 characters"
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
              returnKeyType="next"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color="#757575" 
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={24} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              value={displayConfirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              textContentType="oneTimeCode"
              keyboardType={showConfirmPassword ? "visible-password" : "default"}
              testID="confirmPasswordInput"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
            />
            <TouchableOpacity 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color="#757575" 
              />
            </TouchableOpacity>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.disabledButton]} 
            onPress={handleSignUp}
            disabled={isLoading}
            testID="signUpButton"
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.terms}>
            By signing up, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => {
              console.log('Navigate to Sign In');
              navigation.navigate('SignIn');
            }}>
              <Text style={styles.link}>Sign In</Text>
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
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  terms: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  link: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  signInText: {
    fontSize: 16,
    color: COLORS.text,
  },
  passwordToggle: {
    padding: 8,
  },
});

export default SignUpScreen; 