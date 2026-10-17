import { useWindowDimensions } from 'react-native';

// Brand palette: black base, dark navy brand, purple energy, pink accents.
export const colors = {
  black: '#05050B',
  navyDeep: '#080D24',
  navy: '#0E1636',
  navyLight: '#16204A',
  surface: 'rgba(16, 24, 58, 0.78)',
  surfaceStrong: '#121A40',
  border: 'rgba(139, 120, 255, 0.18)',
  borderStrong: 'rgba(167, 139, 250, 0.45)',
  purple: '#8B5CF6',
  purpleDeep: '#5B21B6',
  purpleSoft: 'rgba(139, 92, 246, 0.16)',
  pink: '#FF2E93',
  pinkSoft: 'rgba(255, 46, 147, 0.14)',
  text: '#F4F2FF',
  textMuted: '#A9ACCD',
  textDim: '#6F7399',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  overlay: 'rgba(3, 4, 12, 0.72)',
};

// Wordmark gradient (navy → blue-purple → dark purple), lifted slightly so it
// stays readable on the black/navy background.
export const wordmarkGradient = ['#4F63E0', '#7B6CF6', '#9A3FE0'];

export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const BREAKPOINTS = { tablet: 700, desktop: 1100 };

// Responsive helper used by every screen. Phone: one column + bottom nav.
// Tablet: more room, two columns. Desktop: sidebar + wide dashboard.
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = !isDesktop && width >= BREAKPOINTS.tablet;
  const isPhone = !isDesktop && !isTablet;
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;
  const contentMaxWidth = isDesktop ? 1080 : isTablet ? 760 : 560;
  const gutter = isPhone ? 16 : 28;
  // Wide enough to show the suggestion card and Party Plan side by side.
  const sideBySide = width >= 1000;
  return { width, height, isPhone, isTablet, isDesktop, columns, contentMaxWidth, gutter, sideBySide };
}
