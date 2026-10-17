import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { colors, fonts } from '../theme';
import { Logo, Wordmark } from './Brand';
import { Button, T } from './ui';
import { useStartParty } from './useStartParty';

export const NAV_ITEMS = [
  { route: 'home', emoji: '🏠', label: 'Home' },
  { route: 'events', emoji: '🎉', label: 'Events' },
  { route: 'profile', emoji: '🧠', label: 'My Profile' },
];

// Screens that live "inside" the app shell (with navigation visible).
export const SHELL_ROUTES = ['home', 'events', 'profile', 'ideas', 'event'];

function activeFor(routeName) {
  if (routeName === 'event') return 'events';
  return routeName;
}

export function BottomNav() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const active = activeFor(nav.route.name);
  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {NAV_ITEMS.map((item) => {
        const on = active === item.route;
        return (
          <Pressable
            key={item.route}
            onPress={() => nav.reset(item.route)}
            accessibilityRole="tab"
            aria-selected={on}
            accessibilityLabel={item.label}
            style={styles.tab}
          >
            <Text style={{ fontSize: 20, opacity: on ? 1 : 0.6 }}>{item.emoji}</Text>
            <T variant="tiny" color={on ? colors.text : colors.textDim} style={on && { fontFamily: fonts.extrabold }}>
              {item.label}
            </T>
            {on ? <View style={styles.tabGlow} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sidebar() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const startParty = useStartParty();
  const { savedIdeas } = useAppState();
  const active = activeFor(nav.route.name);
  const items = [...NAV_ITEMS, { route: 'ideas', emoji: '💡', label: `Saved Ideas${savedIdeas.length ? ` (${savedIdeas.length})` : ''}` }];
  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + 24 }]}>
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Logo size={64} />
        <View style={{ marginTop: 8 }}>
          <Wordmark width={180} />
        </View>
      </View>
      {items.map((item) => {
        const on = active === item.route;
        return (
          <Pressable
            key={item.route}
            onPress={() => nav.reset(item.route)}
            accessibilityRole="tab"
            aria-selected={on}
            style={({ pressed }) => [styles.sideItem, on && styles.sideItemOn, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ fontSize: 18, width: 30 }}>{item.emoji}</Text>
            <T variant="bodyBold" color={on ? colors.text : colors.textMuted}>
              {item.label}
            </T>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Button title="New event" icon="🎉" size="md" onPress={startParty} full />
      <View style={{ height: 24 + insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(6, 8, 22, 0.96)',
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  tabGlow: { position: 'absolute', top: -9, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.pink, boxShadow: '0 0 10px rgba(255,46,147,0.8)' },
  sidebar: {
    width: 248,
    paddingHorizontal: 18,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: 'rgba(6, 8, 22, 0.72)',
  },
  sideItem: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 14, borderRadius: 14, marginBottom: 6 },
  sideItemOn: { backgroundColor: colors.purpleSoft, borderWidth: 1, borderColor: colors.borderStrong },
});
