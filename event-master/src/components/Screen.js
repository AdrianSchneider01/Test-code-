import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNav } from '../state/Navigation';
import { colors, useLayout } from '../theme';
import { T } from './ui';

export function ProgressDots({ step, total = 5 }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i < step && styles.dotOn]} />
      ))}
    </View>
  );
}

// Standard screen frame: header (back / title / progress), scrollable content
// centred to a responsive max width, and an optional sticky footer.
export function Screen({ children, back = true, onBack, title, progress, footer, scroll = true, hasNav = false, maxWidth, headerRight }) {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, gutter } = useLayout();
  const width = maxWidth || contentMaxWidth;
  const showBack = back && (onBack || nav.canGoBack);

  const header =
    showBack || title || progress || headerRight ? (
      <View style={[styles.header, { paddingHorizontal: gutter, maxWidth: width + gutter * 2 }]}>
        <View style={styles.headerSide}>
          {showBack ? (
            <Pressable onPress={onBack || nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={styles.backBtn}>
              <T variant="label" muted>
                ← Back
              </T>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {progress ? <ProgressDots step={progress} /> : title ? (
            <T variant="label" muted numberOfLines={1}>
              {title}
            </T>
          ) : null}
        </View>
        <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{headerRight}</View>
      </View>
    ) : null;

  const body = (
    <View style={{ width: '100%', maxWidth: width, alignSelf: 'center', paddingHorizontal: gutter }}>{children}</View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {header ? <View style={{ alignItems: 'center' }}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: footer ? 24 : hasNav ? 24 : 40 + insets.bottom }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{body}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: (hasNav ? 12 : 12 + insets.bottom) }]}>
            <View style={{ width: '100%', maxWidth: width, alignSelf: 'center', paddingHorizontal: gutter }}>{footer}</View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', height: 56, flexDirection: 'row', alignItems: 'center' },
  headerSide: { width: 96 },
  backBtn: { minHeight: 44, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textDim },
  dotOn: { backgroundColor: colors.pink, borderColor: colors.pink, boxShadow: '0 0 8px rgba(255,46,147,0.6)' },
  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(139,120,255,0.12)', backgroundColor: 'rgba(5,5,11,0.82)' },
});
