import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLOUR_SWATCH, capitalise, eventTypeOf, getCategory, getSlot, vibeLabel } from '../data/categories';
import { getProduct } from '../data/catalog';
import { budgetSummary, categoryProgress, categoryTotal, itemTotal } from '../logic/engine';
import { formatDate, money } from '../logic/util';
import { colors, fonts, radius } from '../theme';
import { Button, Card, StatusPill, T, Tag } from './ui';

// Product "image": a colour-tinted tile with the product emoji. Real product
// photos replace this in Build Phase 4.
export function ProductVisual({ emoji, colour, size = 64 }) {
  const tint = (colour && COLOUR_SWATCH[colour]) || colors.purple;
  return (
    <LinearGradient
      colors={[`${tint}55`, 'rgba(14,22,54,0.9)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${tint}55` }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </LinearGradient>
  );
}

export function openLink(url) {
  if (url) Linking.openURL(url).catch(() => {});
}

export function ViewProductLink({ url }) {
  if (!url) {
    return (
      <T variant="tiny" dim>
        Product link coming soon
      </T>
    );
  }
  return <Button variant="tertiary" title="View product ↗" onPress={() => openLink(url)} size="md" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />;
}

export function BudgetBar({ event, compact }) {
  const b = budgetSummary(event);
  return (
    <View>
      <View style={styles.rowBetween}>
        <T variant={compact ? 'small' : 'bodyBold'}>💰 Party total</T>
        <T variant={compact ? 'small' : 'bodyBold'} style={{ fontFamily: fonts.extrabold }}>
          {money(b.total)}
          {b.budget != null ? <T variant={compact ? 'small' : 'body'} muted>{` / ${money(b.budget)}`}</T> : null}
        </T>
      </View>
      {b.budget != null ? (
        <>
          <View style={styles.track}>
            <LinearGradient
              colors={b.over ? [colors.danger, colors.danger] : [colors.purple, colors.pink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${Math.max(2, b.ratio * 100)}%`, height: '100%', borderRadius: 4 }}
            />
          </View>
          <T variant="small" color={b.over ? colors.danger : colors.textMuted}>
            {b.over ? `Over budget by ${money(-b.remaining)}` : `${money(b.remaining)} remaining`}
          </T>
        </>
      ) : (
        <T variant="small" muted style={{ marginTop: 6 }}>
          No budget set
        </T>
      )}
    </View>
  );
}

// The big one-at-a-time suggestion card.
export function SuggestionCard({ suggestion, onSave, saved, onExplain, explaining, explanation }) {
  const p = suggestion.product;
  const slot = getSlot(p.category, p.slot);
  return (
    <Card glow style={{ padding: 22 }}>
      <View style={{ alignItems: 'center' }}>
        <ProductVisual emoji={p.emoji} colour={p.colour} size={128} />
      </View>
      <T variant="h1" center style={{ marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {p.name}
      </T>
      <T muted center style={{ marginTop: 4 }}>
        {capitalise(p.colour)} · {p.packLabel} · {capitalise(p.style)} style
      </T>
      <View style={styles.priceBox}>
        <T variant="h2">
          {money(p.price)} × {suggestion.qty}
        </T>
        <T variant="label" color={colors.pink} style={{ marginTop: 4, fontSize: 14 }}>
          Total: {money(suggestion.lineTotal)}
        </T>
      </View>
      <T muted center>
        {p.description}
      </T>
      <View style={[styles.rowBetween, { marginTop: 14, flexWrap: 'wrap', gap: 8 }]}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Tag>{slot ? slot.name : 'Party item'}</Tag>
          <Tag>🏪 {p.retailer}</Tag>
          {p.sample ? <Tag color={colors.warning} bg="rgba(251,191,36,0.1)">Sample product</Tag> : null}
        </View>
        <ViewProductLink url={p.url} />
      </View>
      <View style={styles.why}>
        <T variant="label" color={colors.purple} style={{ marginBottom: 6 }}>
          ✦ Why this was suggested
        </T>
        {suggestion.reasons.map((r) => (
          <T key={r} variant="small" muted>
            • {r}
          </T>
        ))}
        {explanation ? (
          <T variant="small" style={{ marginTop: 10 }}>
            ✨ {explanation}
          </T>
        ) : onExplain ? (
          explaining ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, minHeight: 44 }}>
              <ActivityIndicator color={colors.purple} size="small" />
              <T variant="small" muted>
                Explaining…
              </T>
            </View>
          ) : (
            <Button variant="tertiary" size="sm" title="Explain this pick" icon="✨" onPress={onExplain} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 }} />
          )
        ) : null}
      </View>
      {onSave ? (
        <Button variant="tertiary" title={saved ? 'Saved to ideas' : 'Save idea'} icon={saved ? '💜' : '♡'} onPress={onSave} style={{ marginTop: 6 }} />
      ) : null}
    </Card>
  );
}

// Compact list row for an accepted item (shopping-style lists).
export function ItemRow({ item, onPress, showLink = true }) {
  const content = (
    <View style={styles.itemRow}>
      <ProductVisual emoji={item.emoji} colour={item.colour} size={52} />
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <T variant="bodyBold" numberOfLines={1}>
          {item.name}
        </T>
        <T variant="small" muted numberOfLines={1}>
          Qty {item.qty}
          {item.packLabel ? ` × ${item.packLabel}` : ''} · {money(item.unitPrice)} each
          {item.retailer ? ` · ${item.retailer}` : item.custom ? ' · Your own item' : ''}
        </T>
        {showLink ? <ViewProductLink url={item.url} /> : null}
      </View>
      <T variant="bodyBold" style={{ marginLeft: 8 }}>
        {money(itemTotal(item))}
      </T>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.name}, open details`} style={({ pressed }) => pressed && { opacity: 0.75 }}>
      {content}
    </Pressable>
  );
}

export function venueText(venue) {
  if (!venue || !venue.name) return 'Venue not set';
  return venue.mode === 'search' ? `Looking in: ${venue.name}` : venue.name;
}

export function EventSummary({ event, compact }) {
  const type = eventTypeOf(event);
  const rows = [
    [type.emoji, 'Event', event.type === 'other' && event.typeOther ? event.typeOther : type.label],
    ['📅', 'Date', formatDate(event.date)],
    ['📍', 'Venue', venueText(event.venue)],
    ['👥', 'Guests', String(event.guests)],
    ['💰', 'Budget', event.budget != null ? money(event.budget) : 'Not sure yet'],
    ['🎨', 'Vibe', event.vibes.length ? event.vibes.map((v) => (v === 'other' && event.otherVibe ? event.otherVibe : vibeLabel(v))).join(', ') : 'Not set'],
  ];
  return (
    <View style={{ gap: compact ? 6 : 10 }}>
      {rows.map(([emoji, label, value]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={{ width: 28, fontSize: 16 }}>{emoji}</Text>
          <T variant="small" muted style={{ width: 70 }}>
            {label}
          </T>
          <T variant="small" style={{ flex: 1, fontFamily: fonts.bold }}>
            {value}
          </T>
        </View>
      ))}
    </View>
  );
}

// Category card used on the Party Plan screen.
export function CategoryCard({ event, categoryId, onStart, onItem }) {
  const cat = getCategory(categoryId);
  const prog = categoryProgress(event, categoryId);
  const items = event.items.filter((i) => i.category === categoryId);
  const action = prog.status === 'not_started' ? 'Start →' : prog.status === 'complete' ? 'Review →' : 'Continue →';
  return (
    <Card style={{ flexGrow: 1 }}>
      <View style={styles.rowBetween}>
        <T variant="h3">
          {cat.emoji} {cat.name}
        </T>
        <T variant="bodyBold">{money(categoryTotal(event, categoryId))}</T>
      </View>
      <View style={[styles.rowBetween, { marginTop: 8 }]}>
        <StatusPill status={prog.status} />
        <T variant="tiny" dim>
          {prog.resolved}/{prog.total} resolved
        </T>
      </View>
      {items.length ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          {items.map((i) => (
            <Pressable key={i.id} onPress={() => onItem(i)} accessibilityRole="button" hitSlop={4} style={{ minHeight: 30, justifyContent: 'center' }}>
              <T variant="small" muted numberOfLines={1}>
                {i.emoji} {i.name} <T variant="small" dim>· {money(itemTotal(i))}</T>
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
        <Button title={action} variant={prog.status === 'complete' ? 'secondary' : 'primary'} size="sm" onPress={onStart} />
      </View>
    </Card>
  );
}

export function CategoryTotals({ event }) {
  return (
    <View style={{ gap: 10 }}>
      {event.categories.map((c) => {
        const cat = getCategory(c);
        return (
          <View key={c} style={styles.rowBetween}>
            <T>
              {cat.emoji} {cat.name}
            </T>
            <T variant="bodyBold">{money(categoryTotal(event, c))}</T>
          </View>
        );
      })}
    </View>
  );
}

export function productDetails(item) {
  const p = item.productId ? getProduct(item.productId) : null;
  return p;
}

export function BudgetBreakdown({ event }) {
  const b = budgetSummary(event);
  const cells = [
    ['Total', money(b.total)],
    ['Budget', b.budget != null ? money(b.budget) : '—'],
    ['Remaining', b.remaining != null ? money(b.remaining) : '—'],
  ];
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        {cells.map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <T variant="label" dim numberOfLines={1} style={{ letterSpacing: 0.6, fontSize: 11 }}>
              {label}
            </T>
            <T variant="h2" color={label === 'Remaining' && b.over ? colors.danger : colors.text} style={{ marginTop: 4 }}>
              {value}
            </T>
          </View>
        ))}
      </View>
      <BudgetBar event={event} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 10, marginBottom: 8, overflow: 'hidden' },
  priceBox: { alignItems: 'center', marginVertical: 16, paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(8,13,36,0.6)' },
  why: { marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: colors.purpleSoft, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(8,13,36,0.6)', borderWidth: 1, borderColor: colors.border },
});
