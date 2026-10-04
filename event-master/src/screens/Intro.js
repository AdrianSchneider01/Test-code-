import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, Wordmark } from '../components/Brand';
import { FadeIn } from '../components/Effects';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Gap, T, nativeDriver } from '../components/ui';
import { useStartParty } from '../components/useStartParty';
import { newDraft } from '../logic/events';
import { profileFromMemories } from '../logic/memory';
import { useAppState, useMemories } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { useLayout } from '../theme';

// SCREEN 1 — Splash / loading
export function SplashScreen() {
  const nav = useNav();
  const { hydrated, events } = useAppState();
  const [pulse] = useState(() => new Animated.Value(0));
  const [intro] = useState(() => new Animated.Value(0));
  const [minTimeDone, setMinTimeDone] = useState(false);

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: nativeDriver }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    const t = setTimeout(() => setMinTimeDone(true), 1800);
    return () => {
      loop.stop();
      clearTimeout(t);
    };
  }, [intro, pulse]);

  useEffect(() => {
    if (hydrated && minTimeDone) nav.reset(events.length ? 'home' : 'welcome');
  }, [hydrated, minTimeDone, events.length, nav]);

  return (
    <View style={styles.center}>
      <Animated.View
        style={{
          opacity: intro,
          transform: [
            { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
          ],
        }}
      >
        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
          <Logo size={148} />
        </Animated.View>
      </Animated.View>
      <FadeIn delay={250} style={{ marginTop: 18 }}>
        <Wordmark width={280} />
      </FadeIn>
      <FadeIn delay={500}>
        <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }}>
          <T muted center style={{ marginTop: 10 }}>
            Let’s get this party started…
          </T>
        </Animated.View>
      </FadeIn>
    </View>
  );
}

// SCREEN 2 — Welcome
export function WelcomeScreen() {
  const nav = useNav();
  const startParty = useStartParty();
  const insets = useSafeAreaInsets();
  const { isPhone } = useLayout();
  return (
    <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }]}>
      <FadeIn>
        <View style={{ alignItems: 'center' }}>
          <Logo size={isPhone ? 110 : 140} />
          <View style={{ marginTop: 10 }}>
            <Wordmark width={isPhone ? 240 : 300} />
          </View>
        </View>
      </FadeIn>
      <FadeIn delay={150} style={{ width: '100%', maxWidth: 460, marginTop: 36 }}>
        <T variant="display" center>
          🎉 Plan your perfect party
        </T>
        <T muted center style={{ marginTop: 10 }}>
          Tell us what you’re planning, and we’ll help you build it.
        </T>
        <Gap h={32} />
        <Button title="Start a party" icon="✨" onPress={startParty} full />
        <T variant="small" dim center style={{ marginTop: 8 }}>
          Create a new party from scratch.
        </T>
        <Gap h={18} />
        <Button title="Explore first" icon="👀" variant="secondary" onPress={() => nav.navigate('explore')} full />
        <T variant="small" dim center style={{ marginTop: 8 }}>
          Have a look around before starting.
        </T>
      </FadeIn>
    </View>
  );
}

// 42 — New event memory prompt
export function MemoryPromptScreen() {
  const nav = useNav();
  const { startDraft } = useAppState();
  const memories = useMemories();

  const begin = (useMemory) => {
    const vibes = useMemory ? profileFromMemories(memories).vibes : [];
    startDraft(newDraft({ vibes, useMemory }));
    nav.replace('plan1');
  };

  return (
    <Screen>
      <FadeIn>
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Logo size={88} />
        </View>
        <T variant="display" center style={{ marginTop: 18 }}>
          ✨ I’ve got a head start!
        </T>
        <T muted center style={{ marginTop: 8 }}>
          I’ve remembered some things you usually like. Want me to use them for this event?
        </T>
        <Card style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {memories.slice(0, 6).map((m) => (
              <Chip key={m.key} label={m.text} small />
            ))}
          </View>
          <T variant="tiny" dim style={{ marginTop: 12 }}>
            Anything you choose for this event always takes priority over old memories.
          </T>
        </Card>
        <Gap h={24} />
        <Button title="Yes, use them →" onPress={() => begin(true)} full />
        <Gap h={12} />
        <Button title="No, start fresh →" variant="secondary" onPress={() => begin(false)} full />
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
});

