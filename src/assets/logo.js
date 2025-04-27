import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Logo = ({ size = 100, color = '#2E7D32' }) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text style={[styles.text, { color }]}>RE</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 50,
    backgroundColor: '#F0F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  text: {
    fontSize: 36,
    fontWeight: 'bold',
  },
});

export default Logo; 