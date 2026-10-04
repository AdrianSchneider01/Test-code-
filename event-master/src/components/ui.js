import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, useLayout } from '../theme';

export const nativeDriver = Platform.OS !== 'web';

// ── Text ────────────────────────────────────────────────────────────────────
const VARIANTS = {
  display: { fontFamily: fonts.black, fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  tiny: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase' },
};

export function T({ variant = 'body', color, muted, dim, center, style, children, ...rest }) {
  const c = color || (dim ? colors.textDim : muted ? colors.textMuted : colors.text);
  return (
    <Text style={[VARIANTS[variant], { color: c }, center && { textAlign: 'center' }, style]} {...rest}>
      {children}
    </Text>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────
const SIZES = { lg: { height: 56, px: 26, font: 16 }, md: { height: 48, px: 20, font: 15 }, sm: { height: 40, px: 14, font: 13 } };

export function Button({ title, onPress, variant = 'primary', size = 'lg', disabled, full, style, icon, accessibilityLabel }) {
  const s = SIZES[size];
  if (variant === 'tertiary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        hitSlop={8}
        style={({ pressed }) => [styles.tertiary, { minHeight: 44, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }, style]}
      >
        <T variant="label" color={disabled ? colors.textDim : colors.textMuted} style={{ fontSize: s.font - 2 }}>
          {icon ? `${icon} ` : ''}
          {title}
        </T>
      </Pressable>
    );
  }
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      aria-disabled={!!disabled}
      style={({ pressed }) => [
        { borderRadius: radius.pill, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] },
        full && { alignSelf: 'stretch' },
        primary && !disabled && styles.pinkGlow,
        style,
      ]}
    >
      {primary ? (
        <LinearGradient
          colors={['#FF2E93', '#FF4FA3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, { height: s.height, paddingHorizontal: s.px }]}
        >
          <T variant="label" color="#fff" style={{ fontSize: s.font, letterSpacing: 1.2 }}>
            {icon ? `${icon}  ` : ''}
            {title}
          </T>
        </LinearGradient>
      ) : (
        <View style={[styles.btn, styles.secondary, { height: s.height, paddingHorizontal: s.px }]}>
          <T variant="label" color={colors.text} style={{ fontSize: s.font, letterSpacing: 1.2 }}>
            {icon ? `${icon}  ` : ''}
            {title}
          </T>
        </View>
      )}
    </Pressable>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────
export function Card({ children, style, glow, onPress, padded = true, accessibilityLabel }) {
  const inner = [styles.card, padded && { padding: 18 }, glow && styles.purpleGlow, style];
  if (!onPress) return <View style={inner}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...inner, pressed && { borderColor: colors.borderStrong, transform: [{ scale: 0.99 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({ label, emoji, selected, onPress, style, small }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      aria-checked={!!selected}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        small && { minHeight: 36, paddingHorizontal: 12 },
        selected && styles.chipSelected,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {emoji ? <Text style={{ fontSize: small ? 14 : 17, marginRight: 8 }}>{emoji}</Text> : null}
      <T variant={small ? 'tiny' : 'small'} color={selected ? colors.text : colors.textMuted} style={selected && { fontFamily: fonts.bold }}>
        {label}
      </T>
    </Pressable>
  );
}

const STATUS = {
  not_started: { label: 'Not started', color: colors.textDim, bg: 'rgba(111,115,153,0.14)' },
  in_progress: { label: 'In progress', color: colors.warning, bg: 'rgba(251,191,36,0.12)' },
  complete: { label: 'Complete', color: colors.success, bg: 'rgba(52,211,153,0.12)' },
};

export function StatusPill({ status, label }) {
  const s = STATUS[status] || STATUS.not_started;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <T variant="tiny" color={s.color}>
        {status === 'complete' ? '✓ ' : ''}
        {label || s.label}
      </T>
    </View>
  );
}

export function Tag({ children, color = colors.textMuted, bg = 'rgba(255,255,255,0.06)' }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T variant="tiny" color={color}>
        {children}
      </T>
    </View>
  );
}

export function SectionTitle({ children, right, style }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <T variant="label" muted>
        {children}
      </T>
      {right}
    </View>
  );
}

export function Gap({ h = 16 }) {
  return <View style={{ height: h }} />;
}

// Lays children out in N responsive columns with consistent gaps.
export function Grid({ columns, gap = 14, children }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  if (columns <= 1) {
    return <View style={{ gap }}>{items}</View>;
  }
  const rows = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((child, c) => (
            <View key={c} style={{ flex: 1, minWidth: 0 }}>
              {child}
            </View>
          ))}
          {Array.from({ length: columns - row.length }).map((_, k) => (
            <View key={`pad${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────
export function Field({ label, prefix, style, inputStyle, error, ...props }) {
  return (
    <View style={style}>
      {label ? (
        <T variant="small" muted style={{ marginBottom: 8 }}>
          {label}
        </T>
      ) : null}
      <View style={[styles.field, error && { borderColor: colors.danger }]}>
        {prefix ? (
          <T variant="bodyBold" muted style={{ marginRight: 6 }}>
            {prefix}
          </T>
        ) : null}
        <TextInput placeholderTextColor={colors.textDim} style={[styles.input, inputStyle]} {...props} />
      </View>
      {error ? (
        <T variant="tiny" color={colors.danger} style={{ marginTop: 6 }}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 999, accessibilityLabel = 'Quantity' }) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // Keep the text box in sync when the value changes from outside.
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${accessibilityLabel}`} onPress={() => set(value - 1)} style={styles.stepBtn} disabled={value <= min}>
        <T variant="h2" color={value <= min ? colors.textDim : colors.text}>
          −
        </T>
      </Pressable>
      <TextInput
        value={text}
        accessibilityLabel={accessibilityLabel}
        onChangeText={(t) => {
          const clean = t.replace(/[^0-9]/g, '');
          setText(clean);
          if (clean) set(Number(clean));
        }}
        onBlur={() => setText(String(value))}
        keyboardType="number-pad"
        style={[styles.input, styles.stepInput]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${accessibilityLabel}`} onPress={() => set(value + 1)} style={styles.stepBtn} disabled={value >= max}>
        <T variant="h2">+</T>
      </Pressable>
    </View>
  );
}

// ── Sheet (bottom sheet on phones, centred dialog on larger screens) ───────
export function Sheet({ visible, onClose, title, subtitle, children }) {
  const { isPhone } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, isPhone ? { justifyContent: 'flex-end' } : { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            isPhone
              ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 20 + insets.bottom, maxHeight: '88%' }
              : { width: '100%', maxWidth: 520, maxHeight: '86%' },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {title ? <T variant="h2">{title}</T> : null}
            {subtitle ? (
              <T muted style={{ marginTop: 6 }}>
                {subtitle}
              </T>
            ) : null}
            <View style={{ marginTop: title ? 18 : 0 }}>{children}</View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Option row used inside sheets.
export function OptionRow({ emoji, label, sub, onPress, selected }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.option, selected && styles.chipSelected, pressed && { opacity: 0.75 }]}
    >
      {emoji ? <Text style={{ fontSize: 20, width: 32 }}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <T variant="bodyBold">{label}</T>
        {sub ? (
          <T variant="small" muted>
            {sub}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (text) => {
      clearTimeout(timer.current);
      setMsg(text);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: nativeDriver }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 260, useNativeDriver: nativeDriver }).start(() => setMsg(null));
      }, 1900);
    },
    [anim],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            { top: insets.top + 14, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
          ]}
        >
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <T variant="small" style={{ fontFamily: fonts.bold }}>
              {msg}
            </T>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  secondary: { backgroundColor: colors.navyLight, borderWidth: 1, borderColor: colors.borderStrong },
  tertiary: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  pinkGlow: { boxShadow: '0 6px 24px rgba(255, 46, 147, 0.35)' },
  purpleGlow: { boxShadow: '0 0 32px rgba(139, 92, 246, 0.22)', borderColor: colors.borderStrong },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(14, 22, 54, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSelected: { borderColor: colors.purple, backgroundColor: colors.purpleSoft, boxShadow: '0 0 16px rgba(139, 92, 246, 0.25)' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(8, 13, 36, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 16, paddingVertical: 12, outlineStyle: 'none' },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(8,13,36,0.8)' },
  stepBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  stepInput: { flex: 0, width: 64, textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 20 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surfaceStrong, borderRadius: 26, borderWidth: 1, borderColor: colors.border, padding: 22 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(8,13,36,0.6)',
    marginBottom: 10,
  },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  toast: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(30, 20, 70, 0.96)',
    borderWidth: 1,
    borderColor: colors.purple,
    boxShadow: '0 0 24px rgba(139, 92, 246, 0.45)',
  },
});
