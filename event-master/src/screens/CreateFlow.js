import { View } from 'react-native';

import { FadeIn } from '../components/Effects';
import { CategoryPicker, EssentialsFields, TypePicker, essentialsMissing, toggleCategory } from '../components/EventForm';
import { Screen } from '../components/Screen';
import { Button, Field, Gap, T } from '../components/ui';
import { askAI, ownWordsText } from '../ai/client';
import { applyVibeHints } from '../logic/engine';
import { createEventFromDraft } from '../logic/events';
import { useAI, useAppState } from '../state/AppState';
import { useNav } from '../state/Navigation';

function Heading({ title, subtitle }) {
  return (
    <FadeIn>
      <T variant="display">{title}</T>
      <T muted style={{ marginTop: 8, marginBottom: 24 }}>
        {subtitle}
      </T>
    </FadeIn>
  );
}

// Guard for when a draft no longer exists (e.g. app reloaded mid-flow).
function useDraftOrHome() {
  const { draft } = useAppState();
  const nav = useNav();
  return { draft, missing: !draft, goHome: () => nav.reset('splash') };
}

function NoDraft({ goHome }) {
  return (
    <Screen back={false}>
      <T variant="h2" style={{ marginTop: 40 }}>
        This party draft has expired.
      </T>
      <Gap />
      <Button title="Back to start" onPress={goHome} />
    </Screen>
  );
}

// SCREEN 3 — What are you planning?
export function PlanTypeScreen() {
  const nav = useNav();
  const { setDraft } = useAppState();
  const { draft, missing, goHome } = useDraftOrHome();
  if (missing) return <NoDraft goHome={goHome} />;
  const valid = draft.type && draft.name.trim() && (draft.type !== 'other' || draft.typeOther.trim());
  return (
    <Screen progress={1} footer={<Button title="Continue →" onPress={() => nav.navigate('plan2')} disabled={!valid} full />}>
      <Heading title="🎉 What are you planning?" subtitle="Let’s start with the basics." />
      <TypePicker value={draft.type} onChange={(type) => setDraft({ type })} />
      {draft.type === 'other' ? (
        <Field
          style={{ marginTop: 20 }}
          label="What are you celebrating?"
          value={draft.typeOther}
          onChangeText={(typeOther) => setDraft({ typeOther })}
          placeholder="e.g. Engagement party"
        />
      ) : null}
      <Field
        style={{ marginTop: 20 }}
        label="What would you like to call your event?"
        value={draft.name}
        onChangeText={(name) => setDraft({ name })}
        placeholder="e.g. Sofia’s 11th Birthday"
        autoCapitalize="words"
        returnKeyType="done"
      />
    </Screen>
  );
}

// SCREEN 4 — Essentials
export function PlanEssentialsScreen() {
  const nav = useNav();
  const { setDraft } = useAppState();
  const { draft, missing, goHome } = useDraftOrHome();
  if (missing) return <NoDraft goHome={goHome} />;
  const todo = essentialsMissing(draft);
  return (
    <Screen
      progress={2}
      footer={
        <View>
          {todo.length ? (
            <T variant="tiny" dim center style={{ marginBottom: 8 }}>
              Still needed: {todo.join(', ')}
            </T>
          ) : null}
          <Button title="Continue →" onPress={() => nav.navigate('plan3')} disabled={todo.length > 0} full />
        </View>
      }
    >
      <Heading title="✨ Let’s get the essentials sorted" subtitle="These details help us make better recommendations for your party." />
      <EssentialsFields value={draft} onChange={setDraft} />
    </Screen>
  );
}

// SCREEN 5 — What do you want help with?
export function PlanCategoriesScreen() {
  const nav = useNav();
  const { setDraft, addEvent, clearDraft, updateEvent } = useAppState();
  const ai = useAI();
  const { draft, missing, goHome } = useDraftOrHome();
  if (missing) return <NoDraft goHome={goHome} />;
  const n = draft.categories.length;

  const create = () => {
    const ev = createEventFromDraft(draft);
    addEvent(ev);
    clearDraft();
    // Understand an event or vibe described in the user's own words, in the background.
    const words = ownWordsText(ev);
    if (ai.enabled && words) {
      askAI('vibe', { text: words }).then((hints) => hints && updateEvent(ev.id, (e) => applyVibeHints(e, hints)));
    }
    nav.reset([{ name: 'home' }, { name: 'party', params: { eventId: ev.id } }]);
  };

  return (
    <Screen
      progress={3}
      footer={
        <View>
          <T variant="small" muted center style={{ marginBottom: 10 }}>
            Selected: {n} {n === 1 ? 'aspect' : 'aspects'}
          </T>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Back" variant="secondary" onPress={nav.back} style={{ flex: 1 }} />
            <Button title="Continue" onPress={create} disabled={n === 0} style={{ flex: 2 }} />
          </View>
        </View>
      }
    >
      <Heading title="🎉 Now let’s build your party!" subtitle="Choose the things you’d like us to help you plan. You can add or remove these later." />
      <CategoryPicker selected={draft.categories} onToggle={(id) => setDraft((d) => ({ ...d, categories: toggleCategory(d.categories, id) }))} />
    </Screen>
  );
}
