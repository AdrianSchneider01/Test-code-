import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { nativeDriver } from './ui';

const CONFETTI_COLOURS = ['#8B5CF6', '#FF2E93', '#C4B5FD', '#E8B931', '#FFFFFF'];

// A restrained, one-off confetti fall for completion moments.
export function Confetti({ count = 28 }) {
  const { width, height } = useWindowDimensions();
  // Random layout is generated once, when the confetti mounts.
  const [pieces] = useState(() =>
    Array.from({ length: count }).map((_, i) => ({
      x: Math.random() * width,
      delay: Math.random() * 500,
      size: 5 + Math.random() * 5,
      drift: (Math.random() - 0.5) * 80,
      colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      anim: new Animated.Value(0),
    })),
  );

  useEffect(() => {
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.anim, { toValue: 1, duration: 2200, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      ),
    ).start();
  }, [pieces]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: p.colour,
            opacity: p.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.9, 0] }),
            transform: [
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.75] }) },
              { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.drift > 0 ? 300 : -300}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

// Gentle fade/slide-in used for content that appears (next suggestion, etc).
export function FadeIn({ children, delay = 0, from = 16, style }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 340, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [anim, delay]);
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
