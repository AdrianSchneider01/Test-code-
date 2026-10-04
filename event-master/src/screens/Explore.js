import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeIn } from '../components/Effects';
import {
  BudgetBreakdown,
  CategoryTotals,
  EventSummary,
  ItemRow,
  ProductVisual,
  SuggestionCard,
  ViewProductLink,
} from '../components/Plan';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Gap, Grid, OptionRow, SectionTitle, Sheet, T, Tag } from '../components/ui';
import { useStartParty } from '../components/useStartParty';
import { CATEGORIES, capitalise, getCategory, getSlot } from '../data/categories';
import { CATALOG } from '../data/catalog';
import { CATEGORY_EXAMPLES, IDEA_GROUPS } from '../data/ideas';
import { DECLINE_REASONS, applyAccept, applyDecline, planTotal, suggestNext } from '../logic/engine';
import { EXAMPLE_PARTY } from '../logic/events';
import { money } from '../logic/util';
import { useAppState, useIsSaved } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { colors, useLayout } from '../theme';

// Explore Mode never creates or changes a real event. Everything here is
// read-only except saving ideas, which the user does on purpose.

function ExploreFrame({ children, title }) {
  const startParty = useStartParty();
  return (
    <Screen title={title} footer={<Button title="Start my party" icon="🎉" onPress={startParty} full />}>
      {children}
    </Screen>
  );
}

const OPTIONS = [
  { route: 'exploreIdeas', emoji: '💡', title: 'Explore ideas', text: 'Browse party ideas, themes, activities, decorations and more.' },
  { route: 'exploreProducts', emoji: '🛍️', title: 'Browse products', text: 'See examples of products Event Master can recommend.' },
  { route: 'explorePlan', emoji: '🎉', title: 'See what Event Master can plan', text: 'Every part of a party, from decorations to music.' },
  { route: 'exploreHow', emoji: '🧠', title: 'See how Event Master works', text: 'Try the suggest → learn → adapt loop yourself.' },
  { route: 'exploreExample', emoji: '✨', title: 'See an example party', text: 'A finished Event Master plan, start to end.' },
];

export function ExploreScreen() {
  const nav = useNav();
  const { columns } = useLayout();
  return (
    <ExploreFrame>
      <FadeIn>
        <T variant="display">✨ Explore Event Master</T>
        <T muted style={{ marginTop: 8, marginBottom: 24 }}>
          Have a look around and see what Event Master can do.
        </T>
        <Grid columns={Math.min(columns, 2)}>
          {OPTIONS.map((o) => (
            <Card key={o.route} onPress={() => nav.navigate(o.route)} accessibilityLabel={o.title} style={{ minHeight: 120 }}>
              <Text style={{ fontSize: 28 }}>{o.emoji}</Text>
              <T variant="h3" style={{ marginTop: 10 }}>
                {o.title}
              </T>
              <T variant="small" muted style={{ marginTop: 4 }}>
                {o.text}
              </T>
            </Card>
          ))}
        </Grid>
      </FadeIn>
    </ExploreFrame>
  );
}

function SaveIdeaButton({ kind, refId }) {
  const { toggleSavedIdea } = useAppState();
  const saved = useIsSaved(kind, refId);
  return (
    <Button
      variant="tertiary"
      size="sm"
      title={saved ? 'Saved' : 'Save'}
      icon={saved ? '💜' : '♡'}
      onPress={() => toggleSavedIdea(kind, refId)}
      accessibilityLabel={saved ? 'Remove from saved ideas' : 'Save idea'}
    />
  );
}

export function ExploreIdeasScreen() {
  const { columns } = useLayout();
  return (
    <ExploreFrame title="Ideas">
      <T variant="h1">💡 Party ideas</T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        Save anything you love — saved ideas can shape a future party.
      </T>
      {IDEA_GROUPS.map((g) => (
        <View key={g.id} style={{ marginBottom: 24 }}>
          <SectionTitle>{g.title}</SectionTitle>
          <Grid columns={columns}>
            {g.ideas.map((idea) => (
              <Card key={idea.id} style={{ flexGrow: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 28 }}>{idea.emoji}</Text>
                  <SaveIdeaButton kind="idea" refId={idea.id} />
                </View>
                <T variant="h3" style={{ marginTop: 6 }}>
                  {idea.title}
                </T>
                <T variant="small" muted style={{ marginTop: 4 }}>
                  {idea.text}
                </T>
              </Card>
            ))}
          </Grid>
        </View>
      ))}
    </ExploreFrame>
  );
}

export function ProductSheet({ product, onClose }) {
  if (!product) return null;
  const slot = getSlot(product.category, product.slot);
  return (
    <Sheet visible={!!product} onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        <ProductVisual emoji={product.emoji} colour={product.colour} size={110} />
        <T variant="h1" center style={{ marginTop: 14 }}>
          {product.name}
        </T>
        <T muted center style={{ marginTop: 4 }}>
          {capitalise(product.colour)} · {product.packLabel} · {capitalise(product.style)} style
        </T>
        <T variant="h2" style={{ marginTop: 12 }}>
          {money(product.price)}
        </T>
        <T muted center style={{ marginTop: 8 }}>
          {product.description}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Tag>{getCategory(product.category).name}</Tag>
          <Tag>{slot ? slot.name : ''}</Tag>
          <Tag>🏪 {product.retailer}</Tag>
          <Tag color={colors.warning} bg="rgba(251,191,36,0.1)">
            Sample product
          </Tag>
        </View>
        <View style={{ marginTop: 10 }}>
          <ViewProductLink url={product.url} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <SaveIdeaButton kind="product" refId={product.id} />
          <Button variant="secondary" size="md" title="Close" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
}

export function ExploreProductsScreen() {
  const { columns, isPhone } = useLayout();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const list = filter === 'all' ? CATALOG : CATALOG.filter((p) => p.category === filter);
  const cols = isPhone ? 2 : columns + 1;
  return (
    <ExploreFrame title="Products">
      <T variant="h1">🛍️ Browse products</T>
      <T muted style={{ marginTop: 6 }}>
        Examples of products Event Master can recommend. Browsing never adds anything to a party.
      </T>
      <View style={styles.notice}>
        <T variant="small" color={colors.warning}>
          These are sample products. Real products, photos and shop links will be connected later.
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <Chip small label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} small emoji={c.emoji} label={c.name} selected={filter === c.id} onPress={() => setFilter(c.id)} />
        ))}
      </View>
      <Grid columns={cols} gap={12}>
        {list.map((p) => (
          <Card key={p.id} onPress={() => setOpen(p)} accessibilityLabel={p.name} style={{ flexGrow: 1, padding: 14 }} padded={false}>
            <View style={{ alignItems: 'center' }}>
              <ProductVisual emoji={p.emoji} colour={p.colour} size={64} />
            </View>
            <T variant="bodyBold" numberOfLines={2} style={{ marginTop: 10 }}>
              {p.name}
            </T>
            <T variant="tiny" muted numberOfLines={1}>
              {capitalise(p.colour)} · {p.packLabel}
            </T>
            <View style={[styles.rowBetween, { marginTop: 6 }]}>
              <T variant="bodyBold" color={colors.pink}>
                {money(p.price)}
              </T>
              <T variant="tiny" dim numberOfLines={1} style={{ flexShrink: 1, marginLeft: 6 }}>
                {p.retailer}
              </T>
            </View>
          </Card>
        ))}
      </Grid>
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </ExploreFrame>
  );
}

export function ExplorePlanScreen() {
  const { columns } = useLayout();
  const [open, setOpen] = useState(null);
  const cat = open ? getCategory(open) : null;
  return (
    <ExploreFrame title="What I can plan">
      <T variant="h1">🎉 What Event Master can plan</T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        Tap a category to see an example of how I help.
      </T>
      <Grid columns={columns}>
        {CATEGORIES.map((c) => (
          <Card key={c.id} onPress={() => setOpen(c.id)} accessibilityLabel={c.name} style={{ flexGrow: 1 }}>
            <Text style={{ fontSize: 28 }}>{c.emoji}</Text>
            <T variant="h3" style={{ marginTop: 8 }}>
              {c.name}
            </T>
            <T variant="small" muted style={{ marginTop: 4 }}>
              {c.blurb}
            </T>
          </Card>
        ))}
      </Grid>
      <Sheet visible={!!cat} onClose={() => setOpen(null)} title={cat ? `${cat.emoji} ${cat.name}` : ''} subtitle={cat ? cat.blurb : ''}>
        {cat ? (
          <View>
            {CATEGORY_EXAMPLES[cat.id].map((line) => (
              <T key={line} style={{ marginBottom: 8 }}>
                ✦ {line}
              </T>
            ))}
            <SectionTitle style={{ marginTop: 12 }}>I’ll help you choose</SectionTitle>
            {cat.slots.map((s) => (
              <T key={s.id} muted style={{ marginBottom: 4 }}>
                • {s.name}
              </T>
            ))}
            <Gap h={16} />
            <Button title="Got it" variant="secondary" size="md" onPress={() => setOpen(null)} />
          </View>
        ) : null}
      </Sheet>
    </ExploreFrame>
  );
}

// Interactive demo of the recommendation loop. Uses the real engine on a
// throwaway event that is never stored.
const DEMO_EVENT = {
  id: 'demo',
  name: 'Demo party',
  type: 'birthday',
  guests: 10,
  budget: 150,
  vibes: ['cute', 'fun'],
  categories: ['decorations'],
  items: [],
  declines: [],
  skipped: [],
};

export function ExploreHowScreen() {
  const [demo, setDemo] = useState(DEMO_EVENT);
  const [asking, setAsking] = useState(false);
  const [log, setLog] = useState([]);
  const slot = 'balloons';
  const ctx = useMemo(() => ({ profile: null, savedProductIds: [] }), []);
  const { suggestion, relaxed } = useMemo(() => suggestNext(demo, 'decorations', slot, ctx), [demo, ctx]);
  const accepted = demo.items[0];

  const decline = (reason) => {
    const label = DECLINE_REASONS.find((r) => r.id === reason).label;
    setLog((l) => [...l, `You declined ${suggestion.product.name}: “${label}”. I adapted the next suggestion.`]);
    setDemo((d) => applyDecline(d, suggestion, reason));
    setAsking(false);
  };

  return (
    <ExploreFrame title="How it works">
      <T variant="h1">🧠 How Event Master works</T>
      <View style={styles.loop}>
        {['Suggest', 'Learn', 'Adapt', 'Suggest again'].map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tag color={colors.text} bg={colors.purpleSoft}>
              {s}
            </Tag>
            {i < 3 ? <T dim>{'  →  '}</T> : null}
          </View>
        ))}
      </View>
      <T muted style={{ marginBottom: 18 }}>
        Try it: this demo party is cute and fun, for 10 guests with a $150 budget. Accept or decline — when you decline, tell me why and watch
        the next suggestion change. Nothing here is saved.
      </T>
      {accepted ? (
        <Card glow>
          <T variant="h2">✓ Added to the demo plan</T>
          <ItemRow item={accepted} showLink={false} />
          <T muted style={{ marginTop: 8 }}>
            In a real party, I’d update your budget and move on to the next thing — like a garland that goes with these balloons.
          </T>
          <Gap h={14} />
          <Button
            title="Try again"
            variant="secondary"
            size="md"
            onPress={() => {
              setDemo(DEMO_EVENT);
              setLog([]);
            }}
          />
        </Card>
      ) : suggestion ? (
        <FadeIn key={suggestion.product.id}>
          {relaxed ? (
            <View style={styles.notice}>
              <T variant="small" color={colors.warning}>
                I couldn’t find one that matches everything you asked for, so here’s the closest option.
              </T>
            </View>
          ) : null}
          <SuggestionCard suggestion={suggestion} />
          <View style={styles.actions}>
            <Button title="Decline" icon="❌" variant="secondary" onPress={() => setAsking(true)} style={{ flex: 1 }} />
            <Button title="Accept" icon="✓" onPress={() => setDemo((d) => applyAccept(d, suggestion))} style={{ flex: 1 }} />
          </View>
        </FadeIn>
      ) : (
        <Card>
          <T>You’ve seen every demo option.</T>
          <Gap h={12} />
          <Button title="Reset demo" variant="secondary" size="md" onPress={() => setDemo(DEMO_EVENT)} />
        </Card>
      )}
      {log.length ? (
        <View style={{ marginTop: 18 }}>
          <SectionTitle>What I learned</SectionTitle>
          {log.map((l, i) => (
            <T key={i} variant="small" muted style={{ marginBottom: 6 }}>
              ✦ {l}
            </T>
          ))}
        </View>
      ) : null}
      <Sheet visible={asking} onClose={() => setAsking(false)} title="Why didn’t you like it?">
        {DECLINE_REASONS.filter((r) => r.id !== 'other').map((r) => (
          <OptionRow key={r.id} emoji={r.emoji} label={r.label} onPress={() => decline(r.id)} />
        ))}
      </Sheet>
    </ExploreFrame>
  );
}

export function ExampleScreen() {
  const ev = EXAMPLE_PARTY;
  const { sideBySide } = useLayout();
  return (
    <ExploreFrame title="Example party">
      <T variant="label" color={colors.pink}>
        Example party
      </T>
      <T variant="display" style={{ marginTop: 4 }}>
        🎂 {ev.name}
      </T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        This is what a finished Event Master plan looks like.
      </T>
      <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: 16 }}>
        <View style={[{ gap: 16 }, sideBySide && { flex: 1 }]}>
          <Card>
            <SectionTitle>Event details</SectionTitle>
            <EventSummary event={ev} />
          </Card>
          <Card>
            <SectionTitle>Budget</SectionTitle>
            <BudgetBreakdown event={ev} />
          </Card>
          <Card>
            <SectionTitle>Categories</SectionTitle>
            <CategoryTotals event={ev} />
          </Card>
        </View>
        <Card style={sideBySide ? { flex: 1 } : null}>
          <SectionTitle>Selected products</SectionTitle>
          {ev.items.map((i) => (
            <ItemRow key={i.id} item={i} showLink={false} />
          ))}
          <View style={[styles.rowBetween, { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }]}>
            <T variant="h3">Total cost</T>
            <T variant="h3">{money(planTotal(ev))}</T>
          </View>
        </Card>
      </View>
    </ExploreFrame>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notice: { marginVertical: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
  loop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginVertical: 14, rowGap: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});

