import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch,
  TextInput,
  SafeAreaView 
} from 'react-native';

// Mock user profile data
const MOCK_USER = {
  name: 'Sarah Johnson',
  email: 'sarah.johnson@example.com',
  preferences: {
    rvLength: '28 ft',
    trailerLength: 'N/A',
    hasPets: true,
    costPreference: 'Medium ($30-$60/night)',
    hookupNeeds: 'Full Hookups',
    sceneryPriorities: ['Mountains', 'Forests'],
    prepTime: 60 // minutes
  },
  subscription: {
    plan: 'Free',
    tripsUsed: 2,
    tripsLimit: 3
  },
  settings: {
    notifications: true,
    largeText: false,
    highContrast: false,
    voiceoverEnabled: false
  }
};

const SettingsScreen = () => {
  // State for user settings
  const [user, setUser] = useState(MOCK_USER);
  
  // State for editing mode
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState(user.name);
  const [editedEmail, setEditedEmail] = useState(user.email);
  
  // Toggle settings
  const toggleSetting = (setting: keyof typeof user.settings) => {
    setUser({
      ...user,
      settings: {
        ...user.settings,
        [setting]: !user.settings[setting]
      }
    });
  };
  
  // Save profile edits
  const saveProfileEdits = () => {
    setUser({
      ...user,
      name: editedName,
      email: editedEmail
    });
    setIsEditingProfile(false);
  };
  
  // Handle sign out
  const handleSignOut = () => {
    console.log('User signed out');
    // In a real app, this would clear auth tokens and navigate to the auth screen
  };
  
  // Handle upgrade subscription
  const handleUpgrade = () => {
    console.log('User wants to upgrade subscription');
    // In a real app, this would navigate to a subscription screen
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Profile</Text>
          
          {isEditingProfile ? (
            <View style={styles.editForm}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Your Name"
              />
              
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={editedEmail}
                onChangeText={setEditedEmail}
                placeholder="your.email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <View style={styles.editButtons}>
                <TouchableOpacity 
                  style={[styles.editButton, styles.cancelButton]} 
                  onPress={() => setIsEditingProfile(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.editButton, styles.saveButton]} 
                  onPress={saveProfileEdits}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={() => setIsEditingProfile(true)}
              >
                <Text style={styles.editProfileButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* RV Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RV & Trip Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>RV Length</Text>
            <Text style={styles.preferenceValue}>{user.preferences.rvLength}</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Trailer Length</Text>
            <Text style={styles.preferenceValue}>{user.preferences.trailerLength}</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Has Pets</Text>
            <Text style={styles.preferenceValue}>{user.preferences.hasPets ? 'Yes' : 'No'}</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Cost Preference</Text>
            <Text style={styles.preferenceValue}>{user.preferences.costPreference}</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Hookup Needs</Text>
            <Text style={styles.preferenceValue}>{user.preferences.hookupNeeds}</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Scenery Priorities</Text>
            <Text style={styles.preferenceValue}>{user.preferences.sceneryPriorities.join(', ')}</Text>
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Break Camp Prep Time</Text>
            <Text style={styles.preferenceValue}>{user.preferences.prepTime} minutes</Text>
          </View>
          
          <TouchableOpacity style={styles.editPreferencesButton}>
            <Text style={styles.editPreferencesButtonText}>Edit Preferences</Text>
          </TouchableOpacity>
        </View>
        
        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          
          <View style={styles.subscriptionInfo}>
            <Text style={styles.planName}>{user.subscription.plan} Plan</Text>
            <Text style={styles.planUsage}>
              Used {user.subscription.tripsUsed} of {user.subscription.tripsLimit} trips
            </Text>
            
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${(user.subscription.tripsUsed / user.subscription.tripsLimit) * 100}%` }
                ]} 
              />
            </View>
          </View>
          
          {user.subscription.plan === 'Free' && (
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Accessibility & Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accessibility & Notifications</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Switch
              value={user.settings.notifications}
              onValueChange={() => toggleSetting('notifications')}
              trackColor={{ false: '#767577', true: '#2E7D32' }}
              thumbColor={user.settings.notifications ? '#FFF' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Large Text Size</Text>
            <Switch
              value={user.settings.largeText}
              onValueChange={() => toggleSetting('largeText')}
              trackColor={{ false: '#767577', true: '#2E7D32' }}
              thumbColor={user.settings.largeText ? '#FFF' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>High Contrast Mode</Text>
            <Switch
              value={user.settings.highContrast}
              onValueChange={() => toggleSetting('highContrast')}
              trackColor={{ false: '#767577', true: '#2E7D32' }}
              thumbColor={user.settings.highContrast ? '#FFF' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Enable Voiceover</Text>
            <Switch
              value={user.settings.voiceoverEnabled}
              onValueChange={() => toggleSetting('voiceoverEnabled')}
              trackColor={{ false: '#767577', true: '#2E7D32' }}
              thumbColor={user.settings.voiceoverEnabled ? '#FFF' : '#f4f3f4'}
            />
          </View>
        </View>
        
        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
        
        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>RoamEasy v1.0.0</Text>
          <TouchableOpacity>
            <Text style={styles.privacyLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1', // Sand color
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#37474F', // Charcoal
    marginBottom: 16,
  },
  profileInfo: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#37474F', // Charcoal
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
  },
  editProfileButton: {
    backgroundColor: '#2E7D32', // Forest Green
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  editProfileButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  editForm: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#37474F', // Charcoal
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  saveButton: {
    backgroundColor: '#2E7D32', // Forest Green
  },
  cancelButtonText: {
    color: '#37474F', // Charcoal
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#37474F', // Charcoal
  },
  preferenceValue: {
    fontSize: 16,
    color: '#666',
  },
  editPreferencesButton: {
    backgroundColor: '#2E7D32', // Forest Green
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  editPreferencesButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  subscriptionInfo: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#37474F', // Charcoal
    marginBottom: 4,
  },
  planUsage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2E7D32', // Forest Green
  },
  upgradeButton: {
    backgroundColor: '#FF7043', // Sunset Orange
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#37474F', // Charcoal
  },
  signOutButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 24,
  },
  signOutButtonText: {
    color: '#D32F2F', // Red
    fontWeight: 'bold',
    fontSize: 16,
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appVersion: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  privacyLink: {
    fontSize: 14,
    color: '#2E7D32', // Forest Green
    textDecorationLine: 'underline',
  },
});

export default SettingsScreen; 