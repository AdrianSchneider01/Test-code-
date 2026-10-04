import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { askAI, eventInfo, productFacts } from '../ai/client';

import { Confetti, FadeIn } from '../components/Effects';
import {
  BudgetBar,
  BudgetBreakdown,
  CategoryCard,
  CategoryTotals,
  EventSummary,
  ItemRow,
  ProductVisual,
  SuggestionCard,
  ViewProductLink,
  venueText,
} from '../components/Plan';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Field, Gap, Grid, OptionRow, SectionTitle, Sheet, StatusPill, Stepper, T, Tag, nativeDriver, useToast } from '../components/ui';
import { capitalise, getCategory, getSlot } from '../data/categories';
import { getProduct } from '../data/catalog';
import {
  DECLINE_REASONS,
  REMOVE_REASONS,
  applyAccept,
  applyDecline,
  applyOwnItem,
  applyQty,
  applyRefinement,
  applyRemove,
  applyReplace,
  applySkip,
  categoryProgress,
  interpretNote,
  isPlanComplete,
  itemTotal,
  nextCategoryId,
  nextOpenSlot,
  removeRefinement,
  suggestNext,
} from '../logic/engine';
import { formatDate, money } from '../logic/util';
import { useAI, useAppState, useEvent, useIsSaved, useRecommendationContext } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { colors, fonts, useLayout } from '../theme';

export function MissingEvent() {
  const nav = useNav();
  return (
    <Screen>
      <T variant="h2" style={{ marginTop: 40 }}>
        This event no longer exists.
      </T>
      <Gap />
      <Button title="Go home" onPress={() => nav.reset('home')} />
    </Screen>
  );
}

// ── SCREEN 6 — Your Party Plan / Build Plan ─────────────────────────────────
export function PartyPlanScreen() {
  const nav = useNav();
  const event = useEvent(nav.route.params.eventId);
  const { columns } = useLayout();
  if (!event) return <MissingEvent />;

  const complete = isPlanComplete(event);
  const started = event.items.length > 0 || event.declines.length > 0 || (event.skipped || []).length > 0;
  const openItem = (item) => nav.navigate('item', { eventId: event.id, itemId: item.id });

  return (
    <Screen
      progress={4}
      onBack={() => nav.backTo('home')}
      footer={
        complete ? (
          <Button title="See my finished party" icon="✨" onPress={() => nav.navigate('ready', { eventId: event.id })} full />
        ) : (
          <Button title={started ? 'Continue building' : 'Build my plan'} icon="✨" onPress={() => nav.navigate('suggest', { eventId: event.id })} full />
        )
      }
    >
      <FadeIn>
        <T variant="display">{started ? '🗂️ Your party plan' : '✨ We’ve got the basics!'}</T>
        <T muted style={{ marginTop: 8, marginBottom: 20 }}>
          {started ? `${event.name} — I’ll suggest one thing at a time.` : 'Now let’s start building your party.'}
        </T>
      </FadeIn>
      <Grid columns={columns >= 2 ? 2 : 1}>
        <Card>
          <SectionTitle right={<Button variant="tertiary" size="sm" title="Edit" icon="✏️" onPress={() => nav.navigate('editEvent', { eventId: event.id })} />}>
            {event.name}
          </SectionTitle>
          <EventSummary event={event} compact />
        </Card>
        <Card>
          <SectionTitle>Budget</SectionTitle>
          <BudgetBar event={event} />
          <T variant="tiny" dim style={{ marginTop: 12 }}>
            Updates whenever you accept, change, remove or add items.
          </T>
        </Card>
      </Grid>
      <Gap h={24} />
      <SectionTitle>Planning categories</SectionTitle>
      <Grid columns={columns}>
        {event.categories.map((c) => (
          <CategoryCard key={c} event={event} categoryId={c} onItem={openItem} onStart={() => nav.navigate('suggest', { eventId: event.id, categoryId: c })} />
        ))}
      </Grid>
      <AIIdeas event={event} />
    </Screen>
  );
}

// AI-generated party ideas (themes, activities, touches — never products).
function AIIdeas({ event }) {
  const ai = useAI();
  const { updateEvent, toggleSavedIdea, savedIdeas } = useAppState();
  const toast = useToast();
  const { columns } = useLayout();
  const [loading, setLoading] = useState(false);
  if (!ai.enabled) return null;
  const ideas = event.aiIdeas || [];

  const generate = async () => {
    setLoading(true);
    const res = await askAI('ideas', { event: eventInfo(event) });
    setLoading(false);
    if (res && res.ideas.length) updateEvent(event.id, (e) => ({ ...e, aiIdeas: res.ideas.map((i, n) => ({ ...i, id: `${e.id}-idea-${Date.now()}-${n}` })) }));
    else toast('I couldn’t reach Event Master’s AI — please try again');
  };

  return (
    <View style={{ marginTop: 24 }}>
      <SectionTitle right={ideas.length && !loading ? <Button variant="tertiary" size="sm" title="New ideas" icon="✨" onPress={generate} /> : null}>
        ✨ Ideas for this party
      </SectionTitle>
      {loading ? (
        <Card>
          <Thinking label="Dreaming up ideas…" />
        </Card>
      ) : ideas.length ? (
        <Grid columns={columns}>
          {ideas.map((idea) => {
            const saved = savedIdeas.some((x) => x.kind === 'ai' && x.refId === idea.id);
            return (
              <Card key={idea.id} style={{ flexGrow: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 26 }}>{idea.emoji}</Text>
                  <Button
                    variant="tertiary"
                    size="sm"
                    title={saved ? 'Saved' : 'Save'}
                    icon={saved ? '💜' : '♡'}
                    onPress={() => toggleSavedIdea('ai', idea.id, { emoji: idea.emoji, title: idea.title, text: idea.text, category: idea.category })}
                  />
                </View>
                <T variant="h3" style={{ marginTop: 6 }}>
                  {idea.title}
                </T>
                <T variant="small" muted style={{ marginTop: 4 }}>
                  {idea.text}
                </T>
                <T variant="tiny" dim style={{ marginTop: 8 }}>
                  {getCategory(idea.category).emoji} {getCategory(idea.category).name}
                </T>
              </Card>
            );
          })}
        </Grid>
      ) : (
        <Card>
          <T muted>Want some inspiration? I can suggest themes, activities and special touches that suit this party.</T>
          <Gap h={14} />
          <Button title="Get ideas" icon="✨" size="md" variant="secondary" onPress={generate} style={{ alignSelf: 'flex-start' }} />
        </Card>
      )}
    </View>
  );
}

// Side panel shown next to suggestions on wide screens.
function PlanPanel({ event, onItem }) {
  return (
    <Card>
      <BudgetBar event={event} compact />
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />
      {event.categories.map((c) => {
        const cat = getCategory(c);
        const items = event.items.filter((i) => i.category === c);
        return (
          <View key={c} style={{ marginBottom: 12 }}>
            <View style={styles.rowBetween}>
              <T variant="bodyBold">
                {cat.emoji} {cat.name}
              </T>
              <StatusPill status={categoryProgress(event, c).status} />
            </View>
            {items.map((i) => (
              <T key={i.id} variant="small" muted onPress={() => onItem(i)} style={{ marginTop: 4 }} numberOfLines={1}>
                {i.emoji} {i.name} · {money(itemTotal(i))}
              </T>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

// ── Suggestion system ───────────────────────────────────────────────────────
export function SuggestScreen() {
  const nav = useNav();
  const { params } = nav.route;
  const event = useEvent(params.eventId);
  const { updateEvent, toggleSavedIdea } = useAppState();
  const ctx = useRecommendationContext(event);
  const toast = useToast();
  const { sideBySide, width } = useLayout();
  const [asking, setAsking] = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');
  const ai = useAI();
  // AI work in progress: 'feedback' | 'refine' | null
  const [thinking, setThinking] = useState(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState('');
  const [explained, setExplained] = useState({});
  const [explaining, setExplaining] = useState(null);
  const [preferred] = useState(params.categoryId || null);
  // Holds the suggestion that is animating out; buttons are disabled until a new one shows.
  const [leavingKey, setLeavingKey] = useState(null);
  const [swipe] = useState(() => new Animated.Value(0));

  const replaceItem = event && params.replaceItemId ? event.items.find((i) => i.id === params.replaceItemId) : null;
  const catId = !event ? null : replaceItem ? replaceItem.category : nextCategoryId(event, preferred);
  const slot = !catId ? null : replaceItem ? getSlot(replaceItem.category, replaceItem.slot) : nextOpenSlot(event, catId);
  const result = event && catId && slot ? suggestNext(event, catId, slot.id, ctx, { excludeIds: replaceItem && replaceItem.productId ? [replaceItem.productId] : [] }) : null;
  const suggestion = result ? result.suggestion : null;
  const savedIdea = useIsSaved('product', suggestion ? suggestion.product.id : '');
  const suggestionKey = `${catId}/${slot ? slot.id : ''}/${suggestion ? suggestion.product.id : 'none'}`;

  // Bring the card back only once the NEXT suggestion is on screen, so the
  // previous card never flashes back after its exit animation.
  const busy = leavingKey === suggestionKey;
  useEffect(() => {
    swipe.setValue(0);
  }, [suggestionKey, swipe]);

  if (!event) return <MissingEvent />;
  if (params.replaceItemId && !replaceItem) return <MissingEvent />;
  if (!catId || !slot) {
    // Nothing left to resolve.
    return (
      <Screen title="Party plan">
        <FadeIn>
          <T variant="display" style={{ marginTop: 24 }}>
            ✨ Every category is resolved!
          </T>
          <Gap />
          <Button title="See my party" onPress={() => nav.replace('ready', { eventId: event.id })} />
        </FadeIn>
      </Screen>
    );
  }

  const cat = getCategory(catId);
  const slotIndex = cat.slots.findIndex((s) => s.id === slot.id);
  const openItem = (item) => nav.navigate('item', { eventId: event.id, itemId: item.id });

  const animateOut = (direction, then) => {
    setLeavingKey(suggestionKey);
    Animated.timing(swipe, { toValue: direction, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver }).start(() => then());
  };

  const accept = () => {
    if (!suggestion || busy) return;
    if (replaceItem) {
      animateOut(1, () => {
        updateEvent(event.id, (e) => applyReplace(e, replaceItem.id, suggestion));
        toast('✓ Item changed');
        nav.pop(2);
      });
      return;
    }
    const next = applyAccept(event, suggestion);
    animateOut(1, () => {
      updateEvent(event.id, (e) => applyAccept(e, suggestion));
      if (isPlanComplete(next)) {
        nav.replace('ready', { eventId: event.id });
      } else if (categoryProgress(next, catId).status === 'complete') {
        toast(`${cat.emoji} ${cat.name} complete!`);
      } else {
        toast('✓ Added to your plan');
      }
    });
  };

  const decline = async (reason, note = '') => {
    // "Something else": let AI understand the note (falls back to keywords).
    let aiResult = null;
    if (reason === 'other' && ai.enabled) {
      setThinking('feedback');
      aiResult = await askAI('feedback', { note: note.trim(), product: productFacts(suggestion) });
      setThinking(null);
    }
    setAsking(false);
    setOtherMode(false);
    setOtherText('');
    const learned = aiResult ? aiResult.reasons.length > 0 || aiResult.avoidColours.length > 0 : reason !== 'dislike' && (reason !== 'other' || interpretNote(note).length > 0);
    animateOut(-1, () => {
      updateEvent(event.id, (e) => applyDecline(e, suggestion, reason, note, aiResult));
      if (aiResult && aiResult.summary) toast(`✨ Got it — ${aiResult.summary}`);
      else toast(learned ? '✦ Preference updated' : 'Got it — I won’t suggest that again');
    });
  };

  // "Ask Event Master": a request in the user's own words that steers the plan.
  const askEventMaster = async (text) => {
    const t = text.trim();
    if (!t) return;
    setThinking('refine');
    const res = await askAI('refine', { text: t, event: eventInfo(event), product: suggestion ? productFacts(suggestion) : undefined });
    setThinking(null);
    if (!res) {
      toast('I couldn’t reach Event Master’s AI — please try again');
      return;
    }
    setAskOpen(false);
    setAskText('');
    updateEvent(event.id, (e) => applyRefinement(e, t, res));
    toast(`✨ ${res.summary || 'Got it'}`);
  };

  const explain = async () => {
    if (!suggestion) return;
    const key = suggestion.product.id;
    setExplaining(key);
    const res = await askAI('explain', { product: productFacts(suggestion), reasons: suggestion.reasons, event: eventInfo(event) });
    setExplaining(null);
    if (res && res.explanation) setExplained((m) => ({ ...m, [key]: res.explanation }));
    else toast('I couldn’t reach Event Master’s AI — please try again');
  };

  const skip = () => {
    updateEvent(event.id, (e) => applySkip(e, catId, slot.id));
    const next = applySkip(event, catId, slot.id);
    if (isPlanComplete(next)) nav.replace('ready', { eventId: event.id });
    else toast(`Skipped ${slot.name.toLowerCase()}`);
  };

  const ownItem = () => nav.navigate('ownItem', { eventId: event.id, categoryId: catId, slotId: slot.id, replaceItemId: replaceItem ? replaceItem.id : null });

  const travel = Math.min(width, 700) * 0.7;
  const cardStyle = {
    opacity: swipe.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [
      { translateX: swipe.interpolate({ inputRange: [-1, 0, 1], outputRange: [-travel, 0, travel] }) },
      { rotate: swipe.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-8deg', '0deg', '6deg'] }) },
      { scale: swipe.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.96, 1, 0.9] }) },
    ],
  };
  const acceptGlow = swipe.interpolate({ inputRange: [-1, 0, 0.3, 1], outputRange: [0, 0, 1, 0] });

  const actionButtons = (
    <>
      <Button title="Decline" icon="❌" variant="secondary" onPress={() => setAsking(true)} disabled={busy} style={{ flex: 1 }} />
      <Button title="Accept" icon="✓" onPress={accept} disabled={busy} style={{ flex: 1 }} />
    </>
  );

  const main = (
    <View>
      {replaceItem ? (
        <View style={styles.banner}>
          <T variant="small">
            Finding a replacement for <T variant="small" style={{ fontFamily: fonts.extrabold }}>{replaceItem.name}</T>. Changing an item doesn’t count as disliking it.
          </T>
        </View>
      ) : null}
      {(event.refinements || []).length ? (
        <View style={styles.refineRow}>
          {event.refinements.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => updateEvent(event.id, (e) => removeRefinement(e, r.id))}
              accessibilityRole="button"
              accessibilityLabel={`Remove request: ${r.summary || r.text}`}
              style={styles.refineChip}
            >
              <T variant="tiny">💬 {r.summary || r.text}  ✕</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {result && result.relaxed ? (
        <View style={[styles.banner, { borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.08)' }]}>
          <T variant="small" color={colors.warning}>
            I couldn’t find one that matches everything you asked for, so here’s the closest option.
          </T>
        </View>
      ) : null}
      {suggestion ? (
        <>
          <Animated.View style={cardStyle}>
            <FadeIn key={suggestion.product.id}>
              <SuggestionCard
                suggestion={suggestion}
                saved={savedIdea}
                onSave={() => toggleSavedIdea('product', suggestion.product.id)}
                onExplain={ai.enabled ? explain : null}
                explaining={explaining === suggestion.product.id}
                explanation={explained[suggestion.product.id]}
              />
            </FadeIn>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.acceptGlow, { opacity: acceptGlow }]} />
          </Animated.View>
          {sideBySide ? <View style={styles.actions}>{actionButtons}</View> : null}
        </>
      ) : (
        <Card>
          <T variant="h2">I’ve run out of options for {slot.name.toLowerCase()}.</T>
          <T muted style={{ marginTop: 8 }}>
            You’ve seen every suggestion I have here. Add your own, or skip this one.
          </T>
        </Card>
      )}
      <View style={styles.tertiaryRow}>
        {ai.enabled ? <Button variant="tertiary" title="Ask Event Master" icon="✨" onPress={() => setAskOpen(true)} /> : null}
        <Button variant="tertiary" title="I already have one" icon="✏️" onPress={ownItem} />
        {replaceItem ? (
          <Button variant="tertiary" title="Keep current item" onPress={nav.back} />
        ) : (
          <Button variant="tertiary" title="Skip this" icon="⏭" onPress={skip} />
        )}
        {!sideBySide ? <Button variant="tertiary" title="View plan" icon="🗂️" onPress={() => nav.backTo('party', { eventId: event.id })} /> : null}
      </View>
    </View>
  );

  // On phones/tablets the decision buttons stay pinned within thumb reach.
  return (
    <Screen
      progress={5}
      maxWidth={sideBySide ? 1080 : undefined}
      footer={!sideBySide && suggestion ? <View style={{ flexDirection: 'row', gap: 12 }}>{actionButtons}</View> : undefined}
    >
      <View style={{ marginBottom: 16 }}>
        <T variant="h1">
          {cat.emoji} {cat.name}
        </T>
        <T muted>
          {slot.name} · step {slotIndex + 1} of {cat.slots.length}
        </T>
      </View>
      {sideBySide ? (
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.3 }}>{main}</View>
          <View style={{ flex: 1 }}>
            <SectionTitle>Your party plan</SectionTitle>
            <PlanPanel event={event} onItem={openItem} />
          </View>
        </View>
      ) : (
        <>
          <Card style={{ marginBottom: 16, paddingVertical: 14 }}>
            <BudgetBar event={event} compact />
          </Card>
          {main}
        </>
      )}

      <Sheet
        visible={asking}
        onClose={() => {
          setAsking(false);
          setOtherMode(false);
        }}
        title="Why didn’t you like it?"
        subtitle="I’ll use this to find a better option."
      >
        {otherMode ? (
          <View>
            <Field label="Tell me more" value={otherText} onChangeText={setOtherText} placeholder="e.g. a bit too bright" autoFocus multiline />
            {ai.enabled ? (
              <T variant="tiny" dim style={{ marginTop: 8 }}>
                ✨ I’ll use AI to understand what you mean.
              </T>
            ) : null}
            <Gap h={14} />
            {thinking === 'feedback' ? (
              <Thinking label="Understanding your feedback…" />
            ) : (
              <Button title="Decline" onPress={() => decline('other', otherText)} disabled={!otherText.trim()} full />
            )}
            <Gap h={8} />
            <Button variant="tertiary" title="Back to reasons" onPress={() => setOtherMode(false)} />
          </View>
        ) : (
          DECLINE_REASONS.map((r) => (
            <OptionRow key={r.id} emoji={r.emoji} label={r.label} onPress={() => (r.id === 'other' ? setOtherMode(true) : decline(r.id))} />
          ))
        )}
      </Sheet>

      <Sheet
        visible={askOpen}
        onClose={() => setAskOpen(false)}
        title="✨ Ask Event Master"
        subtitle="Tell me what you’d like and I’ll adjust the rest of your suggestions."
      >
        <Field value={askText} onChangeText={setAskText} placeholder="e.g. something more elegant" autoFocus multiline accessibilityLabel="Your request" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {['Something more elegant', 'Cheaper options please', 'More colourful', 'No pink'].map((ex) => (
            <Chip key={ex} small label={ex} onPress={() => setAskText(ex)} />
          ))}
        </View>
        <Gap h={16} />
        {thinking === 'refine' ? (
          <Thinking label="Thinking about your request…" />
        ) : (
          <Button title="Ask" icon="✨" onPress={() => askEventMaster(askText)} disabled={!askText.trim()} full />
        )}
      </Sheet>
    </Screen>
  );
}

export function Thinking({ label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 10 }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.pink} />
      <T muted>{label}</T>
    </View>
  );
}

// ── 29–34: Accepted item details, CHANGE and REMOVE ────────────────────────
export function ItemScreen() {
  const nav = useNav();
  const { eventId, itemId } = nav.route.params;
  const event = useEvent(eventId);
  const { updateEvent } = useAppState();
  const toast = useToast();
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState(null);
  const item = event ? event.items.find((i) => i.id === itemId) : null;
  if (!event || !item) return <MissingEvent />;

  const product = item.productId ? getProduct(item.productId) : null;
  const cat = getCategory(item.category);
  const slot = getSlot(item.category, item.slot);

  const remove = () => {
    updateEvent(event.id, (e) => applyRemove(e, item.id, reason));
    setRemoving(false);
    toast('Removed from your plan');
    nav.back();
  };

  return (
    <Screen title={`${cat.emoji} ${cat.name}`}>
      <FadeIn>
        <Card glow style={{ padding: 22 }}>
          <View style={{ alignItems: 'center' }}>
            <ProductVisual emoji={item.emoji} colour={item.colour} size={110} />
            <T variant="h1" center style={{ marginTop: 14 }}>
              {item.name}
            </T>
            <T muted center style={{ marginTop: 4 }}>
              {slot ? slot.name : ''}
              {item.retailer ? ` · ${item.retailer}` : item.custom ? ' · Your own item' : ''}
            </T>
          </View>
          <View style={[styles.rowBetween, { marginTop: 22 }]}>
            <View>
              <T variant="label" dim>
                Quantity
              </T>
              <View style={{ marginTop: 8 }}>
                <Stepper value={item.qty} onChange={(q) => updateEvent(event.id, (e) => applyQty(e, item.id, q))} />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T variant="label" dim>
                Price
              </T>
              <T variant="h2" style={{ marginTop: 8 }}>
                {money(item.unitPrice)}
                {item.packLabel ? <T muted>{` / ${item.packLabel}`}</T> : null}
              </T>
              <T variant="label" color={colors.pink} style={{ marginTop: 4 }}>
                Total {money(itemTotal(item))}
              </T>
            </View>
          </View>
          <View style={{ marginTop: 18, gap: 6 }}>
            {product ? (
              <>
                <T muted>{product.description}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  <Tag>{capitalise(product.colour)}</Tag>
                  <Tag>{capitalise(product.style)} style</Tag>
                  <Tag>🏪 {product.retailer}</Tag>
                  {product.sample ? (
                    <Tag color={colors.warning} bg="rgba(251,191,36,0.1)">
                      Sample product
                    </Tag>
                  ) : null}
                </View>
              </>
            ) : null}
            {item.notes ? <T muted>📝 {item.notes}</T> : null}
            <ViewProductLink url={item.url} />
          </View>
        </Card>
        <View style={[styles.actions, { marginTop: 20 }]}>
          <Button title="Change" variant="primary" onPress={() => setChanging(true)} style={{ flex: 1 }} />
          <Button title="Remove" variant="secondary" onPress={() => setRemoving(true)} style={{ flex: 1 }} />
        </View>
      </FadeIn>

      <Sheet visible={changing} onClose={() => setChanging(false)} title="What would you like to do?">
        <OptionRow
          emoji="✨"
          label="Help me find a replacement"
          sub="Based on your event, budget, choices and feedback."
          onPress={() => {
            setChanging(false);
            nav.navigate('suggest', { eventId: event.id, replaceItemId: item.id });
          }}
        />
        <OptionRow
          emoji="✏️"
          label="I already have one"
          sub="Enter your own replacement."
          onPress={() => {
            setChanging(false);
            nav.navigate('ownItem', { eventId: event.id, categoryId: item.category, slotId: item.slot, replaceItemId: item.id });
          }}
        />
      </Sheet>

      <Sheet visible={removing} onClose={() => setRemoving(false)} title={`Remove ${item.name}?`} subtitle="Optional: tell me why. A one-off removal won’t change what I remember about you.">
        {REMOVE_REASONS.map((r) => (
          <OptionRow key={r.id} label={r.label} selected={reason === r.id} onPress={() => setReason(reason === r.id ? null : r.id)} />
        ))}
        <Gap h={6} />
        <Button title="Remove item" onPress={remove} full />
        <Gap h={8} />
        <Button variant="tertiary" title="Cancel" onPress={() => setRemoving(false)} />
      </Sheet>
    </Screen>
  );
}

// ── 32: "I already have one" (own item, optionally replacing) ──────────────
export function OwnItemScreen() {
  const nav = useNav();
  const { eventId, categoryId, slotId, replaceItemId } = nav.route.params;
  const event = useEvent(eventId);
  const { updateEvent } = useAppState();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', price: '', qty: '1', url: '', notes: '' });
  if (!event) return <MissingEvent />;
  const slot = getSlot(categoryId, slotId);
  const priceOk = form.price.trim() !== '' && Number(form.price) >= 0;
  const valid = form.name.trim() && priceOk;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = () => {
    const url = form.url.trim() ? (/^https?:\/\//i.test(form.url.trim()) ? form.url.trim() : `https://${form.url.trim()}`) : null;
    updateEvent(event.id, (e) => applyOwnItem(e, { categoryId, slotId, name: form.name, price: form.price, qty: form.qty, url, notes: form.notes }, replaceItemId));
    toast(replaceItemId ? '✓ Item replaced' : '✓ Added to your plan');
    // From an item's CHANGE flow, return past the (now replaced) item screen.
    nav.pop(replaceItemId ? 2 : 1);
  };

  return (
    <Screen title="Your own item" footer={<Button title="Add to my plan" onPress={save} disabled={!valid} full />}>
      <T variant="h1">✏️ I already have one</T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        {slot ? `Add your own ${slot.name.toLowerCase()} to the plan.` : 'Add your own item to the plan.'}
      </T>
      <View style={{ gap: 16 }}>
        <Field label="Item name *" value={form.name} onChangeText={(name) => set({ name })} placeholder="e.g. Balloons from the cupboard" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field
            style={{ flex: 1 }}
            label="Price each *"
            prefix="$"
            value={form.price}
            onChangeText={(t) => set({ price: t.replace(/[^0-9.]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <Field
            style={{ flex: 1 }}
            label="Quantity"
            value={form.qty}
            onChangeText={(t) => set({ qty: t.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>
        <T variant="tiny" dim>
          Already own it? Enter 0 as the price.
        </T>
        <Field label="Link (optional)" value={form.url} onChangeText={(url) => set({ url })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        <Field label="Notes (optional)" value={form.notes} onChangeText={(notes) => set({ notes })} multiline placeholder="Anything to remember" />
      </View>
    </Screen>
  );
}

// ── 38–40: Your party is ready! ─────────────────────────────────────────────
export function ReadyScreen() {
  const nav = useNav();
  const event = useEvent(nav.route.params.eventId);
  const { saveParty } = useAppState();
  const { sideBySide, isPhone } = useLayout();
  const [savedSheet, setSavedSheet] = useState(false);
  if (!event) return <MissingEvent />;
  const saved = event.status === 'saved';

  return (
    <View style={{ flex: 1 }}>
      <Screen
        onBack={() => nav.backTo('party', { eventId: event.id })}
        maxWidth={sideBySide ? 1080 : undefined}
        footer={
          <View style={{ flexDirection: isPhone ? 'column-reverse' : 'row', gap: isPhone ? 8 : 12 }}>
            {saved ? (
              <Button title="I’m done!" icon="✨" onPress={() => nav.reset('home')} style={{ flex: 1 }} />
            ) : (
              <>
                <Button title="I’m done!" variant="secondary" onPress={() => nav.reset('home')} style={isPhone ? undefined : { flex: 1 }} size={isPhone ? 'md' : 'lg'} />
                <Button
                  title="Save my party"
                  icon="🗂️"
                  onPress={() => {
                    saveParty(event.id);
                    setSavedSheet(true);
                  }}
                  style={isPhone ? undefined : { flex: 1.4 }}
                />
              </>
            )}
          </View>
        }
      >
        <FadeIn>
          <T variant="display" center style={{ marginTop: 8 }}>
            ✨ YOUR PARTY IS READY!
          </T>
          <T variant="h2" center style={{ marginTop: 10 }}>
            {event.name}
          </T>
          <T muted center style={{ marginTop: 4, marginBottom: 22 }}>
            {formatDate(event.date)} · {venueText(event.venue)} · {event.guests} guests
          </T>
        </FadeIn>
        <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: 16 }}>
          <View style={[{ gap: 16 }, sideBySide && { flex: 1 }]}>
            <Card glow>
              <SectionTitle>Budget</SectionTitle>
              <BudgetBreakdown event={event} />
            </Card>
            <Card>
              <SectionTitle>Category summary</SectionTitle>
              <CategoryTotals event={event} />
            </Card>
          </View>
          <Card style={sideBySide ? { flex: 1 } : null}>
            <SectionTitle>🛍️ All your items</SectionTitle>
            {event.items.length ? (
              event.items.map((i) => <ItemRow key={i.id} item={i} onPress={() => nav.navigate('item', { eventId: event.id, itemId: i.id })} />)
            ) : (
              <T muted>No items — everything was skipped or handled elsewhere.</T>
            )}
          </Card>
        </View>
        <Gap />
        <Button variant="tertiary" title="Keep editing my plan" onPress={() => nav.backTo('party', { eventId: event.id })} />
      </Screen>
      {!saved ? <Confetti /> : null}
      <Sheet visible={savedSheet} onClose={() => setSavedSheet(false)}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 44 }}>🗂️</Text>
          <T variant="h1" center style={{ marginTop: 10 }}>
            ✨ Your party has been saved!
          </T>
          <T muted center style={{ marginTop: 10 }}>
            I’ll remember the things I’ve learned from this event and use them next time.
          </T>
          <Gap h={22} />
          <Button
            title="I’m done!"
            icon="✨"
            onPress={() => {
              setSavedSheet(false);
              nav.reset('home');
            }}
            full
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tertiaryRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  banner: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.purpleSoft, marginBottom: 14 },
  refineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  refineChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.purpleSoft, borderWidth: 1, borderColor: colors.borderStrong },
  acceptGlow: { borderRadius: 22, borderWidth: 2, borderColor: colors.pink, boxShadow: '0 0 40px rgba(255,46,147,0.55), inset 0 0 30px rgba(139,92,246,0.4)' },
});
