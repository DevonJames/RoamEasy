import { useNavigation } from '@react-navigation/native';
import { resetToAuth, resetToMain } from '../navigation/navigationHelper';

/**
 * Hook to provide app-wide navigation functionality, including auth state resets
 * Use this in screens that need to navigate across different navigator contexts
 */
const useAppNavigation = () => {
  const navigation = useNavigation();
  
  // Now just returning the imported functions - they use the global ref
  return {
    navigation,
    resetToAuth,
    resetToMain
  };
};

export default useAppNavigation; 