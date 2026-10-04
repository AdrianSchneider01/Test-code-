import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, EVENT_TYPES, VIBES } from '../data/categories';
import { todayISO } from '../logic/util';
import { colors, useLayout } from '../theme';
import { Calendar } from './Calendar';
import { Card, Chip, Field, Grid, SectionTitle, Stepper, T } from './ui';

// Pieces shared by the create flow and "Edit event".

export function TypePicker({ value, onChange }) {
  const { isPhone } = useLayout();
  return (
    <Grid columns={isPhone ? 2 : 3} gap={12}>
      {EVENT_TYPES.map((t) => {
        const on = value === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={t.label}
            style={({ pressed }) => [styles.typeCard, on && styles.typeOn, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ fontSize: 30 }}>{t.emoji}</Text>
            <T variant="bodyBold" center style={{ marginTop: 8 }} color={on ? colors.text : colors.textMuted}>
              {t.label}
            </T>
          </Pressable>
        );
      })}
    </Grid>
  );
}

export function VenueFields({ venue, onChange }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Chip emoji="🔎" label="Find a venue" selected={venue.mode === 'search'} onPress={() => onChange({ ...venue, mode: 'search' })} />
        <Chip emoji="✏️" label="I already have a venue" selected={venue.mode === 'own'} onPress={() => onChange({ ...venue, mode: 'own' })} />
      </View>
      {venue.mode === 'search' ? (
        <View style={{ marginTop: 14 }}>
          <View style={styles.notice}>
            <T variant="small" color={colors.warning}>
              Venue search isn’t connected yet. Tell me the area you’re looking in for now — you can update the venue any time.
            </T>
          </View>
          <Field
            label="Area or suburb you’re looking in"
            value={venue.name}
            onChangeText={(name) => onChange({ ...venue, name })}
            placeholder="e.g. Bondi"
            autoCapitalize="words"
          />
        </View>
      ) : null}
      {venue.mode === 'own' ? (
        <Field
          style={{ marginTop: 14 }}
          label="Venue name or address"
          value={venue.name}
          onChangeText={(name) => onChange({ ...venue, name })}
          placeholder="e.g. Home — backyard"
          autoCapitalize="words"
        />
      ) : null}
    </View>
  );
}

// onChange receives an updater function (prev => next) so rapid taps never
// work from stale state.
export function EssentialsFields({ value, onChange, allowPastDates }) {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const toggleVibe = (id) => onChange((prev) => ({ ...prev, vibes: prev.vibes.includes(id) ? prev.vibes.filter((v) => v !== id) : [...prev.vibes, id] }));
  return (
    <View style={{ gap: 18 }}>
      <Card>
        <SectionTitle>📍 Where?</SectionTitle>
        <T variant="bodyBold" style={{ marginBottom: 12 }}>
          Where is your party happening?
        </T>
        <VenueFields venue={value.venue} onChange={(venue) => set({ venue })} />
      </Card>
      <Card>
        <SectionTitle>📅 When?</SectionTitle>
        <Calendar value={value.date} onChange={(date) => set({ date })} minDate={allowPastDates ? undefined : todayISO()} />
      </Card>
      <Card>
        <SectionTitle>👥 Guests</SectionTitle>
        <Stepper value={value.guests} onChange={(guests) => set({ guests })} min={1} max={500} accessibilityLabel="Guest count" />
      </Card>
      <Card>
        <SectionTitle>💰 Budget</SectionTitle>
        <Field
          prefix="$"
          value={value.budgetUnsure ? '' : value.budgetText}
          onChangeText={(t) => set({ budgetText: t.replace(/[^0-9.]/g, ''), budgetUnsure: false })}
          placeholder="300"
          keyboardType="decimal-pad"
          accessibilityLabel="Budget"
        />
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Chip label="I’m not sure yet" selected={value.budgetUnsure} onPress={() => onChange((prev) => ({ ...prev, budgetUnsure: !prev.budgetUnsure }))} />
        </View>
      </Card>
      <Card>
        <SectionTitle>🎨 Vibe</SectionTitle>
        <T variant="small" muted style={{ marginBottom: 12 }}>
          Pick as many as you like.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {VIBES.map((v) => (
            <Chip key={v.id} emoji={v.emoji} label={v.label} selected={value.vibes.includes(v.id)} onPress={() => toggleVibe(v.id)} />
          ))}
        </View>
        {value.vibes.includes('other') ? (
          <Field style={{ marginTop: 14 }} label="Describe your vibe" value={value.otherVibe} onChangeText={(otherVibe) => set({ otherVibe })} placeholder="e.g. Under the sea" />
        ) : null}
      </Card>
    </View>
  );
}

// Toggle a category while keeping the canonical category order.
export function toggleCategory(list, id) {
  return list.includes(id) ? list.filter((c) => c !== id) : CATEGORIES.map((c) => c.id).filter((c) => c === id || list.includes(c));
}

// onToggle(id) — the parent applies toggleCategory with a functional update.
export function CategoryPicker({ selected, onToggle }) {
  const { columns } = useLayout();
  const toggle = onToggle;
  return (
    <Grid columns={columns} gap={12}>
      {CATEGORIES.map((c) => {
        const on = selected.includes(c.id);
        return (
          <Pressable
            key={c.id}
            onPress={() => toggle(c.id)}
            accessibilityRole="checkbox"
            aria-checked={on}
            accessibilityLabel={c.name}
            style={({ pressed }) => [styles.catCard, on && styles.typeOn, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ fontSize: 26 }}>{c.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T variant="bodyBold" color={on ? colors.text : colors.textMuted}>
                {c.name}
              </T>
              <T variant="tiny" dim numberOfLines={2}>
                {c.blurb}
              </T>
            </View>
            <View style={[styles.check, on && styles.checkOn]}>{on ? <T variant="tiny" color="#fff">✓</T> : null}</View>
          </Pressable>
        );
      })}
    </Grid>
  );
}

// What's still missing on the essentials step (foundational information).
export function essentialsMissing(v) {
  const missing = [];
  if (!v.venue.mode || !v.venue.name.trim()) missing.push('venue');
  if (!v.date) missing.push('date');
  if (!v.guests || v.guests < 1) missing.push('guest count');
  const n = Number(v.budgetText);
  if (!v.budgetUnsure && !(n > 0)) missing.push('budget (or “I’m not sure yet”)');
  return missing;
}

const styles = StyleSheet.create({
  typeCard: {
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  typeOn: { borderColor: colors.purple, backgroundColor: 'rgba(139,92,246,0.18)', boxShadow: '0 0 22px rgba(139,92,246,0.3)' },
  catCard: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkOn: { backgroundColor: colors.pink, borderColor: colors.pink },
  notice: { marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
});
