import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

const tectangleLogo = require('../../assets/tectangle-logo.png');

interface PoweredByFooterProps {
  style?: ViewStyle;
  bottomPadding?: number;
}

export function PoweredByFooter({ style, bottomPadding = 32 }: PoweredByFooterProps) {
  const handlePress = async () => {
    try {
      await Linking.openURL('https://www.tectangle.com/');
    } catch (e) {
      console.warn('Failed to open Tectangle website:', e);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }, style]}>
      <Pressable
        onPress={handlePress}
        style={styles.pressable}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.text}>powered by</Text>
        <Image
          source={tectangleLogo}
          style={styles.logo}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'lowercase',
  },
  logo: {
    width: 136,
    height: 26,
    marginLeft: -6,
  },
});
