import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { FadeIn } from '../components/Effects';
import { CategoryPicker, EssentialsFields, TypePicker, essentialsMissing, toggleCategory } from '../components/EventForm';
import { EventSummary, ItemRow, ProductVisual } from '../components/Plan';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Field, Gap, Grid, OptionRow, SectionTitle, Sheet, T, Tag, useToast } from '../components/ui';
import { useStartParty } from '../components/useStartParty';
import { eventTypeOf, getCategory } from '../data/categories';
import { getProduct } from '../data/catalog';
import { getIdea } from '../data/ideas';
import {
  analyseChanges,
  applyEdit,
  applyVibeHints,
  applyQty,
  budgetSummary,
  categoryTotal,
  changesNeedReview,
  isPlanComplete,
  itemTotal,
} from '../logic/engine';
import { eventStatusLabel, parseBudget } from '../logic/events';
import {
  MEMORY_SECTIONS,
  MEMORY_TYPES,
  PATTERN_THRESHOLD,
  addManualMemory,
  changeMemory,
  clearAllMemory,
  eventLearnings,
  forgetMemory,
  memoryType,
  optionLabel,
} from '../logic/memory';
import { formatDate, money, pluralise } from '../logic/util';
import { askAI, ownWordsText } from '../ai/client';
import { useAI, useAppState, useEvent, useMemories } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { colors, useLayout } from '../theme';
import { MissingEvent, Thinking } from './Planning';

// ── Shared ──────────────────────────────────────────────────────────────────
function openEvent(nav, event) {
  if (event.status !== 'saved' && !isPlanComplete(event)) nav.navigate('party', { eventId: event.id });
  else nav.navigate('event', { eventId: event.id });
}

function EventRow({ event }) {
  const nav = useNav();
  const label = eventStatusLabel(event);
  const completed = label === 'Completed';
  return (
    <Card onPress={() => openEvent(nav, event)} accessibilityLabel={event.name} style={{ paddingVertical: 14 }}>
      <View style={styles.row}>
        <Text style={{ fontSize: 28, marginRight: 12 }}>{eventTypeOf(event).emoji}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="h3" numberOfLines={1}>
            {event.name}
          </T>
          <T variant="small" muted>
            {formatDate(event.date, { withYear: false })} · {label}
          </T>
        </View>
        <T variant="label" color={completed ? colors.textMuted : colors.pink}>
          {completed ? 'View plan →' : 'Continue →'}
        </T>
      </View>
    </Card>
  );
}

function sortEvents(events) {
  return [...events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

// ── 41 — Returning user home ────────────────────────────────────────────────
export function HomeScreen() {
  const nav = useNav();
  const { events, savedIdeas, memory } = useAppState();
  const memories = useMemories();
  const startParty = useStartParty();
  const { columns } = useLayout();
  const recent = sortEvents(events).slice(0, 3);

  return (
    <Screen back={false} hasNav>
      <FadeIn>
        <T variant="display" style={{ marginTop: 12 }}>
          ✨ Welcome back!
        </T>
        <T muted style={{ marginTop: 6, marginBottom: 22 }}>
          What are we planning today?
        </T>
        <Card glow onPress={startParty} accessibilityLabel="Start a new event" style={{ padding: 22 }}>
          <View style={styles.row}>
            <Text style={{ fontSize: 34, marginRight: 14 }}>🎉</Text>
            <View style={{ flex: 1 }}>
              <T variant="h2">Start a new event</T>
              <T muted>Let’s create something amazing.</T>
            </View>
            <T variant="h2" color={colors.pink}>
              →
            </T>
          </View>
        </Card>
      </FadeIn>
      <Gap h={26} />
      <Grid columns={columns >= 2 ? 2 : 1} gap={22}>
        <View>
          <SectionTitle right={events.length > 3 ? <Button variant="tertiary" size="sm" title="See all →" onPress={() => nav.reset('events')} /> : null}>
            📅 Your events
          </SectionTitle>
          <View style={{ gap: 12 }}>
            {recent.length ? recent.map((e) => <EventRow key={e.id} event={e} />) : <T muted>No events yet.</T>}
          </View>
        </View>
        <View style={{ gap: 22 }}>
          <View>
            <SectionTitle>🧠 Your Event Master profile</SectionTitle>
            <Card onPress={() => nav.reset('profile')} accessibilityLabel="View and edit your profile">
              <T variant="h3">✨ What I’ve learned about you</T>
              {!memory.enabled ? (
                <T muted style={{ marginTop: 8 }}>
                  Memory is switched off.
                </T>
              ) : memories.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {memories.slice(0, 4).map((m) => (
                    <Tag key={m.key} color={colors.text} bg={colors.purpleSoft}>
                      {m.source === 'manual' ? optionLabel(m.type, m.value) : m.text}
                    </Tag>
                  ))}
                </View>
              ) : (
                <T muted style={{ marginTop: 8 }}>
                  I’ll start spotting your favourites once you’ve saved a couple of events.
                </T>
              )}
              <T variant="label" color={colors.pink} style={{ marginTop: 14 }}>
                View & edit →
              </T>
            </Card>
          </View>
          <View>
            <SectionTitle>💡 Saved ideas</SectionTitle>
            <Card onPress={() => nav.navigate('ideas')} accessibilityLabel="View all saved ideas">
              {savedIdeas.length ? (
                savedIdeas.slice(0, 3).map((s) => (
                  <T key={s.id} style={{ marginBottom: 4 }} numberOfLines={1}>
                    {savedTitle(s)}
                  </T>
                ))
              ) : (
                <T muted>Save ideas while you explore or plan.</T>
              )}
              <T variant="label" color={colors.pink} style={{ marginTop: 10 }}>
                View all →
              </T>
            </Card>
          </View>
        </View>
      </Grid>
    </Screen>
  );
}

function savedTitle(s) {
  if (s.kind === 'product') {
    const p = getProduct(s.refId);
    return p ? `${p.emoji} ${p.name}` : 'Removed product';
  }
  if (s.kind === 'ai') return s.data ? `${s.data.emoji} ${s.data.title}` : 'Saved idea';
  const idea = getIdea(s.refId);
  return idea ? `${idea.emoji} ${idea.title}` : 'Removed idea';
}

// ── Events list ─────────────────────────────────────────────────────────────
export function EventsScreen() {
  const { events } = useAppState();
  const startParty = useStartParty();
  const groups = [
    ['In progress', sortEvents(events.filter((e) => ['In progress', 'Ready to save'].includes(eventStatusLabel(e))))],
    ['Upcoming', sortEvents(events.filter((e) => eventStatusLabel(e) === 'Upcoming'))],
    ['Completed', sortEvents(events.filter((e) => eventStatusLabel(e) === 'Completed')).reverse()],
  ];
  return (
    <Screen back={false} hasNav>
      <T variant="display" style={{ marginTop: 12 }}>
        🎉 Your events
      </T>
      <Gap h={20} />
      <Button title="Start a new event" icon="🎉" onPress={startParty} size="md" style={{ alignSelf: 'flex-start' }} />
      <Gap h={24} />
      {events.length === 0 ? <T muted>No events yet — start one above.</T> : null}
      {groups.map(([title, list]) =>
        list.length ? (
          <View key={title} style={{ marginBottom: 24 }}>
            <SectionTitle>{title}</SectionTitle>
            <View style={{ gap: 12 }}>
              {list.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </View>
          </View>
        ) : null,
      )}
    </Screen>
  );
}

// ── 43 — Individual event page ──────────────────────────────────────────────
export function EventScreen() {
  const nav = useNav();
  const event = useEvent(nav.route.params.eventId);
  const { saveParty, deleteEvent } = useAppState();
  const toast = useToast();
  const { columns } = useLayout();
  const [open, setOpen] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!event) return <MissingEvent />;

  const complete = isPlanComplete(event);
  const learnings = eventLearnings(event);
  const b = budgetSummary(event);

  return (
    <Screen hasNav title="Event">
      <T variant="label" color={colors.pink}>
        {eventStatusLabel(event)}
      </T>
      <T variant="display" style={{ marginTop: 4 }}>
        {eventTypeOf(event).emoji} {event.name}
      </T>
      <Gap h={18} />
      <Grid columns={columns >= 2 ? 2 : 1}>
        <Card>
          <EventSummary event={event} />
        </Card>
        <Card>
          <SectionTitle>Budget</SectionTitle>
          <T variant="h1">
            {money(b.total)}
            {b.budget != null ? <T muted>{` / ${money(b.budget)}`}</T> : null}
          </T>
          {b.budget != null ? (
            <T color={b.over ? colors.danger : colors.textMuted}>{b.over ? `Over by ${money(-b.remaining)}` : `${money(b.remaining)} remaining`}</T>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            <Button title="Edit event" icon="✏️" variant="secondary" size="sm" onPress={() => nav.navigate('editEvent', { eventId: event.id })} />
            {!complete ? <Button title="Continue planning" size="sm" onPress={() => nav.navigate('party', { eventId: event.id })} /> : null}
            {complete && event.status !== 'saved' ? (
              <Button
                title="Save my party"
                size="sm"
                onPress={() => {
                  saveParty(event.id);
                  toast('✨ Your party has been saved!');
                }}
              />
            ) : null}
          </View>
        </Card>
      </Grid>

      <Gap h={26} />
      <SectionTitle>🗂️ Your plan</SectionTitle>
      <View style={{ gap: 12 }}>
        {event.categories.map((c) => {
          const cat = getCategory(c);
          const items = event.items.filter((i) => i.category === c);
          const isOpen = !!open[c];
          return (
            <Card key={c}>
              <View style={styles.row}>
                <T variant="h3" style={{ flex: 1 }}>
                  {cat.emoji} {cat.name}
                </T>
                <T variant="bodyBold" style={{ marginRight: 12 }}>
                  {money(categoryTotal(event, c))}
                </T>
                <Button variant="tertiary" size="sm" title={isOpen ? 'Hide' : 'View →'} onPress={() => setOpen((o) => ({ ...o, [c]: !isOpen }))} />
              </View>
              {!isOpen ? (
                <T variant="small" muted numberOfLines={1}>
                  {items.length ? items.map((i) => i.name).join(', ') : 'No items'}
                </T>
              ) : (
                items.map((i) => <ItemRow key={i.id} item={i} onPress={() => nav.navigate('item', { eventId: event.id, itemId: i.id })} />)
              )}
            </Card>
          );
        })}
      </View>

      <Gap h={26} />
      <SectionTitle>🛍️ All your items</SectionTitle>
      <Card>
        {event.items.length ? (
          event.items.map((i) => <ItemRow key={i.id} item={i} onPress={() => nav.navigate('item', { eventId: event.id, itemId: i.id })} />)
        ) : (
          <T muted>No items yet.</T>
        )}
      </Card>

      <Gap h={26} />
      <SectionTitle>🧠 What I learned from this event</SectionTitle>
      <Card>
        {learnings.length ? (
          learnings.map((l) => (
            <T key={l} style={{ marginBottom: 6 }}>
              {l}
            </T>
          ))
        ) : (
          <T muted>Nothing yet — accept or decline a few suggestions first.</T>
        )}
        <T variant="tiny" dim style={{ marginTop: 10 }}>
          {event.status === 'saved'
            ? `These count towards your profile. A preference becomes a memory once it shows up in ${PATTERN_THRESHOLD}+ saved events.`
            : 'Save this party to let me learn from it.'}
        </T>
      </Card>

      <Gap h={20} />
      <Button variant="tertiary" title="Delete this event" onPress={() => setConfirmDelete(true)} />
      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${event.name}?`} subtitle="This removes the event and its plan. It can’t be undone.">
        <Button
          title="Delete event"
          onPress={() => {
            setConfirmDelete(false);
            deleteEvent(event.id);
            nav.reset('events');
          }}
          full
        />
        <Gap h={8} />
        <Button variant="tertiary" title="Cancel" onPress={() => setConfirmDelete(false)} />
      </Sheet>
    </Screen>
  );
}

// ── Edit event (with "Your party has changed" warning) ─────────────────────
export function EditEventScreen() {
  const nav = useNav();
  const event = useEvent(nav.route.params.eventId);
  const { updateEvent } = useAppState();
  const ai = useAI();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    event
      ? {
          name: event.name,
          type: event.type,
          typeOther: event.typeOther || '',
          date: event.date,
          venue: { ...event.venue },
          guests: event.guests,
          budgetText: event.budget != null ? String(event.budget) : '',
          budgetUnsure: event.budget == null,
          vibes: [...event.vibes],
          otherVibe: event.otherVibe || '',
          categories: [...event.categories],
        }
      : null,
  );
  const [pending, setPending] = useState(null);
  if (!event || !form) return <MissingEvent />;

  const missing = essentialsMissing(form);
  if (!form.name.trim()) missing.unshift('event name');
  if (form.type === 'other' && !form.typeOther.trim()) missing.unshift('what you’re celebrating');
  if (!form.categories.length) missing.push('at least one category');
  const losing = event.categories
    .filter((c) => !form.categories.includes(c))
    .map((c) => [getCategory(c), event.items.filter((i) => i.category === c).length])
    .filter(([, n]) => n > 0);

  const save = () => {
    const patch = {
      name: form.name.trim(),
      type: form.type,
      typeOther: form.typeOther.trim(),
      date: form.date,
      venue: { mode: form.venue.mode, name: form.venue.name.trim() },
      guests: form.guests,
      budget: form.budgetUnsure ? null : parseBudget(form.budgetText),
      vibes: form.vibes,
      otherVibe: form.otherVibe.trim(),
      categories: form.categories,
    };
    const after = applyEdit(event, patch);
    const changes = analyseChanges(event, after);
    updateEvent(event.id, (e) => applyEdit(e, patch));
    // Re-read the user's own words if they changed (or drop stale hints).
    const before = ownWordsText(event);
    const words = ownWordsText(after);
    if (words !== before) {
      if (!words) updateEvent(event.id, (e) => applyVibeHints(e, null));
      else if (ai.enabled) askAI('vibe', { text: words }).then((hints) => hints && updateEvent(event.id, (e) => applyVibeHints(e, hints)));
    }
    if (changesNeedReview(changes)) setPending(changes);
    else {
      toast('✓ Event updated');
      nav.back();
    }
  };

  return (
    <Screen
      title="Edit event"
      footer={
        <View>
          {missing.length ? (
            <T variant="tiny" dim center style={{ marginBottom: 8 }}>
              Still needed: {missing.join(', ')}
            </T>
          ) : null}
          <Button title="Save changes" onPress={save} disabled={missing.length > 0} full />
        </View>
      }
    >
      <T variant="h1">✏️ Edit event</T>
      <Gap h={18} />
      <Field label="Event name" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} />
      <Gap h={18} />
      <SectionTitle>Event type</SectionTitle>
      <TypePicker value={form.type} onChange={(type) => setForm((f) => ({ ...f, type }))} />
      {form.type === 'other' ? (
        <Field style={{ marginTop: 14 }} label="What are you celebrating?" value={form.typeOther} onChangeText={(typeOther) => setForm((f) => ({ ...f, typeOther }))} />
      ) : null}
      <Gap h={22} />
      <EssentialsFields value={form} onChange={setForm} allowPastDates />
      <Gap h={22} />
      <SectionTitle>Planned aspects</SectionTitle>
      <CategoryPicker selected={form.categories} onToggle={(id) => setForm((f) => ({ ...f, categories: toggleCategory(f.categories, id) }))} />
      {losing.length ? (
        <View style={styles.warn}>
          <T variant="small" color={colors.danger}>
            Removing {losing.map(([c, n]) => `${c.name} (${pluralise(n, 'item')})`).join(', ')} will remove those items from your plan.
          </T>
        </View>
      ) : null}

      <Sheet visible={!!pending} onClose={() => nav.back()} title="⚠️ Your party has changed">
        {pending && pending.guests ? (
          <T style={{ marginBottom: 10 }}>
            You’ve changed your guest count from {pending.guests.from} → {pending.guests.to}. Some of your current quantities may need updating.
          </T>
        ) : null}
        {pending && pending.budget ? (
          <T style={{ marginBottom: 10 }}>Your new budget is {money(pending.budget.overBy)} less than your current plan total.</T>
        ) : null}
        {pending && pending.vibes ? (
          <T style={{ marginBottom: 10 }}>You changed your vibe, and {pluralise(pending.vibes.items.length, 'item')} may no longer fit.</T>
        ) : null}
        <Gap h={8} />
        <Button title="Review changes →" onPress={() => nav.replace('review', { eventId: event.id, changes: pending })} full />
        <Gap h={8} />
        <Button variant="tertiary" title="Later" onPress={() => nav.back()} />
      </Sheet>
    </Screen>
  );
}

// ── Review changes ──────────────────────────────────────────────────────────
export function ReviewChangesScreen() {
  const nav = useNav();
  const { eventId, changes } = nav.route.params;
  const event = useEvent(eventId);
  const { updateEvent } = useAppState();
  const toast = useToast();
  if (!event) return <MissingEvent />;
  const b = budgetSummary(event);

  const qtyRows = (changes.guests ? changes.guests.items : [])
    .map((c) => ({ ...c, item: event.items.find((i) => i.id === c.itemId) }))
    .filter((r) => r.item);
  const pendingQty = qtyRows.filter((r) => r.item.qty !== r.to);
  const vibeRows = (changes.vibes ? changes.vibes.items : []).map((c) => event.items.find((i) => i.id === c.itemId)).filter(Boolean);

  const updateAll = () => {
    updateEvent(event.id, (e) => pendingQty.reduce((ev, r) => applyQty(ev, r.itemId, r.to), e));
    toast('✓ Quantities updated');
  };

  return (
    <Screen title="Review changes" footer={<Button title="Done" onPress={() => nav.back()} full />}>
      <T variant="h1">⚠️ Review changes</T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        Your plan is connected — here’s what your edit might affect.
      </T>

      {qtyRows.length ? (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle right={pendingQty.length > 1 ? <Button size="sm" title="Update all" onPress={updateAll} /> : null}>
            👥 Guests: {changes.guests.from} → {changes.guests.to}
          </SectionTitle>
          {qtyRows.map((r) => {
            const done = r.item.qty === r.to;
            return (
              <View key={r.itemId} style={[styles.row, { paddingVertical: 8 }]}>
                <View style={{ flex: 1 }}>
                  <T variant="bodyBold">{r.item.name}</T>
                  <T variant="small" muted>
                    Qty {r.item.qty} → suggested {r.to} · {money(itemTotal(r.item))}
                  </T>
                </View>
                {done ? (
                  <Tag color={colors.success} bg="rgba(52,211,153,0.12)">
                    ✓ Updated
                  </Tag>
                ) : (
                  <Button size="sm" variant="secondary" title="Update" onPress={() => updateEvent(event.id, (e) => applyQty(e, r.itemId, r.to))} />
                )}
              </View>
            );
          })}
        </Card>
      ) : null}

      {changes.budget || b.over ? (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle>💰 Budget</SectionTitle>
          <T>
            Plan total {money(b.total)} / budget {b.budget != null ? money(b.budget) : '—'}.{' '}
            {b.over ? `You’re over by ${money(-b.remaining)}.` : 'You’re back within budget.'}
          </T>
          {b.over ? <Button style={{ marginTop: 12, alignSelf: 'flex-start' }} size="sm" variant="secondary" title="Review my plan →" onPress={() => nav.navigate('party', { eventId: event.id })} /> : null}
        </Card>
      ) : null}

      {vibeRows.length ? (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle>🎨 Items that may not fit your new vibe</SectionTitle>
          {vibeRows.map((item) => (
            <View key={item.id} style={[styles.row, { paddingVertical: 8 }]}>
              <View style={{ flex: 1 }}>
                <T variant="bodyBold">{item.name}</T>
              </View>
              <Button size="sm" variant="secondary" title="Change" onPress={() => nav.navigate('item', { eventId: event.id, itemId: item.id })} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

// ── 46/47 — Memory profile ──────────────────────────────────────────────────
function MemoryEditor({ state, onClose }) {
  const { setMemory } = useAppState();
  const toast = useToast();
  const [type, setType] = useState(state ? state.type : null);
  const [text, setText] = useState('');
  if (!state) return null;
  const t = type ? memoryType(type) : null;
  const sectionTypes = MEMORY_TYPES.filter((x) => x.section === state.section);

  const commit = (value) => {
    if (state.mem) setMemory((m) => changeMemory(m, state.mem, value));
    else setMemory((m) => addManualMemory(m, type, value));
    toast('✦ Preference updated');
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={state.mem ? 'Change memory' : 'Add to your profile'} subtitle={state.mem ? state.mem.text : 'Your changes always override older patterns.'}>
      {!t ? (
        sectionTypes.map((x) => <OptionRow key={x.id} label={x.label} onPress={() => setType(x.id)} />)
      ) : (
        <View>
          <T variant="bodyBold" style={{ marginBottom: 12 }}>
            {t.label}
          </T>
          {t.options ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {t.options.map((o) => (
                <Chip key={o} label={optionLabel(t.id, o)} onPress={() => commit(o)} />
              ))}
            </View>
          ) : (
            <View>
              <Field value={text} onChangeText={setText} placeholder={t.id === 'budget' ? 'e.g. $200–$400' : 'e.g. I like to plan a month ahead'} autoFocus />
              <Gap h={12} />
              <Button title="Save" onPress={() => commit(text)} disabled={!text.trim()} full />
            </View>
          )}
        </View>
      )}
      <Gap h={10} />
      <Button variant="tertiary" title="Cancel" onPress={onClose} />
    </Sheet>
  );
}

function MemoryRow({ mem, onChange }) {
  const { setMemory } = useAppState();
  const toast = useToast();
  return (
    <View style={[styles.row, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(139,120,255,0.1)' }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="bodyBold">{mem.source === 'manual' ? optionLabel(mem.type, mem.value) : mem.text}</T>
        <T variant="tiny" dim>
          {mem.source === 'manual' ? 'Added by you' : `Learned from ${mem.count} events`}
        </T>
      </View>
      <Button variant="tertiary" size="sm" title="Change" onPress={() => onChange(mem)} />
      <Button
        variant="tertiary"
        size="sm"
        title="Forget"
        onPress={() => {
          setMemory((m) => forgetMemory(m, mem));
          toast('Forgotten');
        }}
      />
    </View>
  );
}

// AI: "Tell me about your style" → suggested memories the user confirms.
function TellMeAboutYou() {
  const { setMemory } = useAppState();
  const toast = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null);
  const [picked, setPicked] = useState([]);

  const run = async () => {
    setLoading(true);
    const res = await askAI('memories', { text: text.trim() });
    setLoading(false);
    if (!res) return toast('I couldn’t reach Event Master’s AI — please try again');
    if (!res.memories.length) return toast('I couldn’t spot any preferences in that — try adding colours, styles or shops');
    setFound(res.memories);
    setPicked(res.memories.map((_, i) => i));
  };

  const add = () => {
    setMemory((m) => found.filter((_, i) => picked.includes(i)).reduce((acc, f) => addManualMemory(acc, f.type, f.value), m));
    toast(`✦ Added ${pluralise(picked.length, 'preference')}`);
    setFound(null);
    setText('');
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <T variant="h3">✨ Tell me about your style</T>
      <T variant="small" muted style={{ marginTop: 4, marginBottom: 12 }}>
        Describe what you like in your own words. I’ll suggest preferences to remember — you choose which to keep.
      </T>
      <Field value={text} onChangeText={setText} multiline placeholder="e.g. I love gold and white, keep things elegant, and we usually do cupcakes" accessibilityLabel="Describe your style" />
      <Gap h={12} />
      {loading ? (
        <Thinking label="Reading your preferences…" />
      ) : (
        <Button title="Suggest preferences" icon="✨" size="md" variant="secondary" onPress={run} disabled={!text.trim()} style={{ alignSelf: 'flex-start' }} />
      )}
      <Sheet visible={!!found} onClose={() => setFound(null)} title="Keep these preferences?" subtitle="Untick anything you don’t want me to remember.">
        {(found || []).map((f, i) => (
          <OptionRow
            key={`${f.type}:${f.value}`}
            emoji={picked.includes(i) ? '☑️' : '⬜'}
            label={optionLabel(f.type, f.value)}
            sub={memoryType(f.type).label}
            selected={picked.includes(i)}
            onPress={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
          />
        ))}
        <Gap h={6} />
        <Button title={`Add ${pluralise(picked.length, 'preference')}`} onPress={add} disabled={!picked.length} full />
        <Gap h={8} />
        <Button variant="tertiary" title="Cancel" onPress={() => setFound(null)} />
      </Sheet>
    </Card>
  );
}

// AI: a friendly two-sentence summary of what's been learned.
function ProfileSummary({ memories }) {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const res = await askAI('profileSummary', { memories: memories.slice(0, 40).map((m) => m.text) });
    setLoading(false);
    if (res && res.summary) setSummary(res.summary);
    else toast('I couldn’t reach Event Master’s AI — please try again');
  };
  if (loading) return <Thinking label="Summarising your style…" />;
  if (summary) {
    return (
      <View style={styles.summary}>
        <T>✨ {summary}</T>
      </View>
    );
  }
  return <Button variant="tertiary" size="sm" title="Summarise my style" icon="✨" onPress={run} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />;
}

export function ProfileScreen() {
  const { memory, setMemory, settings, setSettings } = useAppState();
  const ai = useAI();
  const memories = useMemories();
  const toast = useToast();
  const { columns } = useLayout();
  const [editor, setEditor] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const learned = memories.filter((m) => m.source === 'learned');

  return (
    <Screen back={false} hasNav>
      <T variant="display" style={{ marginTop: 12 }}>
        🧠 My Event Master profile
      </T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        Here’s what I’ve learned about you. You’re always in control.
      </T>

      <Card style={{ marginBottom: 20 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <T variant="bodyBold">Use memory when planning</T>
            <T variant="small" muted>
              When off, I won’t use or offer your memories for new events.
            </T>
          </View>
          <Switch
            value={memory.enabled}
            onValueChange={(enabled) => setMemory((m) => ({ ...m, enabled }))}
            trackColor={{ false: colors.navyLight, true: colors.purple }}
            thumbColor={memory.enabled ? colors.pink : colors.textMuted}
            accessibilityLabel="Use memory when planning"
          />
        </View>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <T variant="bodyBold">✨ Use AI features</T>
            <T variant="small" muted>
              {ai.available
                ? 'Helps me understand your words: feedback, requests, vibes and style descriptions. What you type and basic event details (type, vibe, guests, budget — never names or venues) are sent to Event Master’s server and Anthropic’s Claude.'
                : 'AI isn’t connected for this app yet, so I’m using built-in rules.'}
            </T>
          </View>
          <Switch
            value={ai.available && settings.ai}
            disabled={!ai.available}
            onValueChange={(on) => setSettings({ ai: on })}
            trackColor={{ false: colors.navyLight, true: colors.purple }}
            thumbColor={ai.available && settings.ai ? colors.pink : colors.textMuted}
            accessibilityLabel="Use AI features"
          />
        </View>
      </Card>

      {ai.enabled ? <TellMeAboutYou /> : null}

      <Grid columns={Math.min(columns, 3)}>
        {MEMORY_SECTIONS.map((s) => {
          const types = MEMORY_TYPES.filter((t) => t.section === s.id).map((t) => t.id);
          const list = memories.filter((m) => types.includes(m.type));
          return (
            <Card key={s.id} style={{ flexGrow: 1 }}>
              <SectionTitle right={<Button variant="tertiary" size="sm" title="Edit" onPress={() => setEditor({ section: s.id })} />}>
                {s.emoji} {s.title}
              </SectionTitle>
              {list.length ? (
                types.map((t) => {
                  const vals = list.filter((m) => m.type === t);
                  if (!vals.length) return null;
                  return (
                    <View key={t} style={{ marginBottom: 10 }}>
                      <T variant="tiny" dim>
                        {memoryType(t).label}
                      </T>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {vals.map((m) => (
                          <Tag key={m.key} color={colors.text} bg={colors.purpleSoft}>
                            {optionLabel(t, m.value)}
                          </Tag>
                        ))}
                      </View>
                    </View>
                  );
                })
              ) : (
                <T variant="small" muted>
                  Nothing yet. Tap Edit to add your own.
                </T>
              )}
            </Card>
          );
        })}
      </Grid>

      <Gap h={22} />
      <SectionTitle>🧠 What I’ve learned</SectionTitle>
      <Card>
        {ai.enabled && memories.length ? (
          <View style={{ marginBottom: 8 }}>
            <ProfileSummary key={memories.map((m) => m.key).join('|')} memories={memories} />
          </View>
        ) : null}
        {memories.length ? (
          memories.map((m) => <MemoryRow key={m.key} mem={m} onChange={(mem) => setEditor({ section: memoryType(mem.type).section, type: mem.type, mem })} />)
        ) : (
          <T muted>
            Nothing yet. I only remember patterns — a preference needs to show up in at least {PATTERN_THRESHOLD} saved events before I treat it as yours.
          </T>
        )}
        {learned.length ? (
          <T variant="tiny" dim style={{ marginTop: 10 }}>
            Learned memories come from patterns across your saved events.
          </T>
        ) : null}
      </Card>

      <Gap h={22} />
      <Button variant="tertiary" title="Clear all memory" icon="🧹" onPress={() => setConfirmClear(true)} />
      <T variant="tiny" dim center>
        You can also start any new event fresh, without memories.
      </T>

      <MemoryEditor key={editor ? `${editor.section}-${editor.type || ''}-${editor.mem ? editor.mem.key : ''}` : 'none'} state={editor} onClose={() => setEditor(null)} />
      <Sheet visible={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all memory?" subtitle="I’ll forget everything I’ve learned and anything you added. Your events stay as they are.">
        <Button
          title="Clear all memory"
          onPress={() => {
            setMemory((m) => clearAllMemory(m, new Date().toISOString()));
            setConfirmClear(false);
            toast('Memory cleared');
          }}
          full
        />
        <Gap h={8} />
        <Button variant="tertiary" title="Cancel" onPress={() => setConfirmClear(false)} />
      </Sheet>
    </Screen>
  );
}

// ── 48 — Saved ideas ────────────────────────────────────────────────────────
export function SavedIdeasScreen() {
  const nav = useNav();
  const { savedIdeas, toggleSavedIdea } = useAppState();
  const { columns } = useLayout();
  return (
    <Screen hasNav title="Saved ideas">
      <T variant="display">💡 Saved ideas</T>
      <T muted style={{ marginTop: 6, marginBottom: 20 }}>
        I’ll favour saved products when they fit a party you’re planning.
      </T>
      {savedIdeas.length === 0 ? (
        <Card>
          <T muted>No saved ideas yet. Tap ♡ on anything you like while exploring or planning.</T>
          <Gap h={14} />
          <Button title="Explore ideas" icon="💡" size="md" variant="secondary" onPress={() => nav.navigate('exploreIdeas')} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : (
        <Grid columns={columns}>
          {savedIdeas.map((s) => {
            const product = s.kind === 'product' ? getProduct(s.refId) : null;
            const idea = s.kind === 'idea' ? getIdea(s.refId) : s.kind === 'ai' ? s.data : null;
            return (
              <Card key={s.id} style={{ flexGrow: 1 }}>
                <View style={styles.row}>
                  {product ? <ProductVisual emoji={product.emoji} colour={product.colour} size={48} /> : <Text style={{ fontSize: 30 }}>{idea ? idea.emoji : '💡'}</Text>}
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                    <T variant="bodyBold" numberOfLines={1}>
                      {product ? product.name : idea ? idea.title : 'Removed'}
                    </T>
                    <T variant="small" muted numberOfLines={2}>
                      {product ? `${getCategory(product.category).name} · ${money(product.price)} · ${product.retailer}` : idea ? idea.text : ''}
                    </T>
                    {s.kind === 'ai' ? (
                      <T variant="tiny" dim>
                        ✨ AI idea
                      </T>
                    ) : null}
                  </View>
                  <Button variant="tertiary" size="sm" title="Remove" onPress={() => toggleSavedIdea(s.kind, s.refId)} />
                </View>
              </Card>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  summary: { padding: 14, borderRadius: 14, backgroundColor: colors.purpleSoft, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', marginBottom: 6 },
  warn: { marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.08)' },
});
