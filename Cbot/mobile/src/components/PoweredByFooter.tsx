import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';

const tectangleLogo = require('../../assets/tectangle-logo.png');

interface PoweredByFooterProps {
  style?: ViewStyle;
  bottomPadding?: number;
}

export function PoweredByFooter({ style, bottomPadding = 32 }: PoweredByFooterProps) {
  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }, style]}>
      <Text style={styles.text}>powered by</Text>
      <Image
        source={tectangleLogo}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 20,
  },
  text: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'lowercase',
  },
  logo: {
    width: 86,
    height: 16,
  },
});
