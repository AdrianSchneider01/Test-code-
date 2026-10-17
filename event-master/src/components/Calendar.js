import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MONTHS, parseISODate, toISODate, todayISO } from '../logic/util';
import { colors, fonts } from '../theme';
import { T } from './ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Cross-platform month calendar (works identically on iOS, Android and web).
export function Calendar({ value, onChange, minDate }) {
  const base = parseISODate(value) || parseISODate(todayISO());
  const [view, setView] = useState({ y: base.y, m: base.m });
  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const shift = (d) => {
    const m = view.m + d;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.nav} hitSlop={6}>
          <T variant="h2">‹</T>
        </Pressable>
        <T variant="bodyBold">
          {MONTHS[view.m]} {view.y}
        </T>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={styles.nav} hitSlop={6}>
          <T variant="h2">›</T>
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <View key={i} style={styles.cell}>
            <T variant="tiny" dim>
              {d}
            </T>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }).map((_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const iso = toISODate(view.y, view.m, day);
            const disabled = !!minDate && iso < minDate;
            const selected = iso === value;
            const today = iso === todayISO();
            return (
              <Pressable
                key={i}
                disabled={disabled}
                onPress={() => onChange(iso)}
                accessibilityRole="button"
                accessibilityLabel={`${day} ${MONTHS[view.m]} ${view.y}`}
                aria-selected={selected}
                aria-disabled={disabled}
                style={styles.cell}
              >
                <View style={[styles.day, selected && styles.daySel, today && !selected && styles.dayToday]}>
                  <T variant="small" color={disabled ? 'rgba(111,115,153,0.45)' : selected ? '#fff' : colors.text} style={selected && { fontFamily: fonts.extrabold }}>
                    {day}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(8,13,36,0.8)', padding: 10, maxWidth: 420 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: colors.pink, boxShadow: '0 0 12px rgba(255,46,147,0.6)' },
  dayToday: { borderWidth: 1, borderColor: colors.purple },
});
