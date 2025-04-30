import React, { useEffect, useState, ErrorInfo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { validateEnvironment } from './src/utils/environment';

// Ignore specific warnings that are related to the navigation reset, which we're handling
LogBox.ignoreLogs([
  "The action 'RESET' with payload",
  "No navigator handled the action"
]);

// Simple error boundary wrapper
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean, error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>RoamEasy</Text>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorDetail}>
            {this.state.error?.toString() || "Unknown error"}
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.errorButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const { isValid, missing } = validateEnvironment();
        
        if (!isValid) {
          console.error(`Missing environment variables: ${missing.join(', ')}`);
        }
        
        // Mark app as ready to render
        setIsReady(true);
      } catch (error) {
        console.error('Error during environment validation:', error);
        setIsReady(true); // Still mark as ready so we can show an error screen
      }
    };
    
    checkEnvironment();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>RoamEasy</Text>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 14,
    color: '#D32F2F',
    marginBottom: 30,
    textAlign: 'center', 
    padding: 10,
  },
  errorButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 20,
  },
});