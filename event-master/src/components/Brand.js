import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgLinear, Polygon, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { colors, fonts, wordmarkGradient } from '../theme';

// Irregular, spiky "lightning / crystal" outline around EM. The radii and
// angle offsets are hand-tuned so the silhouette feels energetic but not
// aggressive or cartoonish.
const SPIKES = [
  [49, 0], [35, 4], [46, -2], [33, 3], [48, 2], [36, -3], [44, 1], [34, 2],
  [49, -2], [35, 0], [45, 3], [33, -2], [47, 0], [36, 3], [43, -1], [34, 1],
];

function spikePoints(scale = 1, cx = 50, cy = 50) {
  return SPIKES.map(([r, jitter], i) => {
    const a = ((i / SPIKES.length) * 360 + jitter - 90) * (Math.PI / 180);
    return `${(cx + Math.cos(a) * r * scale).toFixed(2)},${(cy + Math.sin(a) * r * scale).toFixed(2)}`;
  }).join(' ');
}

const OUTER = spikePoints(1);
const INNER = spikePoints(0.78);

export function Logo({ size = 96 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinear id="emFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B794FF" />
          <Stop offset="0.5" stopColor="#7C3AED" />
          <Stop offset="1" stopColor="#3B0F8C" />
        </SvgLinear>
        <SvgLinear id="emEdge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F5EEFF" />
          <Stop offset="0.6" stopColor="#C4A5FF" />
          <Stop offset="1" stopColor="#FF7AC3" />
        </SvgLinear>
        <RadialGradient id="emGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#8B5CF6" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="50" rx="50" ry="50" fill="url(#emGlow)" />
      <Polygon points={OUTER} fill="url(#emFill)" stroke="url(#emEdge)" strokeWidth="1.6" strokeLinejoin="miter" />
      <Polygon points={INNER} fill="none" stroke="#E9D5FF" strokeOpacity="0.35" strokeWidth="0.8" />
      <SvgText x="50" y="60.5" textAnchor="middle" fontFamily={fonts.black} fontWeight="900" fontSize="27" fill="#FFFFFF" letterSpacing="-0.5">
        EM
      </SvgText>
    </Svg>
  );
}

// "EVENT MASTER" — bold, rounded, all caps with a navy → blue-purple → purple gradient.
export function Wordmark({ width = 260 }) {
  const height = (width * 84) / 640;
  return (
    <Svg width={width} height={height} viewBox="0 0 640 84">
      <Defs>
        <SvgLinear id="wm" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={wordmarkGradient[0]} />
          <Stop offset="0.5" stopColor={wordmarkGradient[1]} />
          <Stop offset="1" stopColor={wordmarkGradient[2]} />
        </SvgLinear>
      </Defs>
      <SvgText x="320" y="66" textAnchor="middle" fontFamily={fonts.black} fontWeight="900" fontSize="68" letterSpacing="3" fill="url(#wm)">
        EVENT MASTER
      </SvgText>
    </Svg>
  );
}

// Black → deep navy with soft blue/purple atmospheric glows.
export function Background() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[colors.black, colors.navyDeep, '#0A1030']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="g1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#7C3AED" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="g2" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#2546C9" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#2546C9" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="g3" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FF2E93" stopOpacity="0.08" />
            <Stop offset="1" stopColor="#FF2E93" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="88" cy="6" rx="55" ry="38" fill="url(#g1)" />
        <Ellipse cx="6" cy="92" rx="60" ry="40" fill="url(#g2)" />
        <Ellipse cx="30" cy="40" rx="40" ry="26" fill="url(#g3)" />
      </Svg>
    </View>
  );
}
