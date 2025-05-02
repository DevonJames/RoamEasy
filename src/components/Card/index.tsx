import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
// Assuming COLORS might be in constants directly or utils
// Let's remove the direct import for now if it's causing issues
// import { COLORS } from '../constants/theme'; 

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, style, ...props }) => {
  console.log('Rendering Card component');
  return (
    <View style={[styles.card, style]} {...props}>
      <View>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
});

export default Card;
