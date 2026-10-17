import { useState } from 'react';
import { View } from 'react-native';

import { buildBudgetHelpInput } from '../ai/assist';
import { askAI } from '../ai/client';

import { applyRemove, isPlanComplete, itemTotal } from '../logic/engine';
import { money } from '../logic/util';
import { useAI, useAppState, useEvent } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { BudgetBar } from './Plan';
import { Button, Card, Gap, Sheet, T, Tag, useToast } from './ui';

// Pops up on any screen when a change takes a party up to, or over, its budget.
export function BudgetAlert() {
  const { budgetAlert: alert, dismissBudgetAlert, restoreEvent, updateEvent } = useAppState();
  const event = useEvent(alert ? alert.eventId : null);
  const nav = useNav();
  const toast = useToast();
  const ai = useAI();
  // AI help, keyed to the alert it was asked for: { alert, loading, result }
  const [help, setHelp] = useState(null);
  if (!alert || !event) return null;
  const helpNow = help && help.alert === alert ? help : null;

  const over = alert.type === 'over';
  const what = alert.causeName || 'That change';
  const message = over
    ? `${what} takes ${alert.eventName} to ${money(alert.total)} — ${money(alert.overBy)} over your ${money(alert.budget)} budget.`
    : `${what} brings ${alert.eventName} to exactly ${money(alert.budget)}. Anything else you add will take you over.`;

  const undo = () => {
    restoreEvent(alert.previous);
    dismissBudgetAlert();
    toast('↩︎ Change undone');
    // The finished-party screen no longer applies if undoing reopened the plan.
    if (nav.route.name === 'ready' && !isPlanComplete(alert.previous)) nav.backTo('party', { eventId: alert.eventId });
  };

  const askForHelp = async () => {
    const input = buildBudgetHelpInput(event);
    if (!input) return;
    setHelp({ alert, loading: true, result: null });
    const result = await askAI('budgetHelp', input);
    setHelp({ alert, loading: false, result });
    if (!result || !result.suggestions.length) toast('I couldn’t come up with savings just now — try Review my plan');
  };

  const swap = (itemId) => {
    dismissBudgetAlert();
    nav.navigate('suggest', { eventId: alert.eventId, replaceItemId: itemId });
  };

  const remove = (item) => {
    updateEvent(alert.eventId, (e) => applyRemove(e, item.id, 'expensive'));
    dismissBudgetAlert();
    toast(`Removed ${item.name}`);
    if (nav.route.name === 'ready') nav.backTo('party', { eventId: alert.eventId });
  };

  const review = () => {
    dismissBudgetAlert();
    nav.backTo('party', { eventId: alert.eventId });
  };

  return (
    <Sheet visible onClose={dismissBudgetAlert} title={over ? '⚠️ You’re over budget' : '🎯 You’ve hit your budget'}>
      <T>{message}</T>
      <Card style={{ marginTop: 16, borderColor: over ? 'rgba(248,113,113,0.45)' : 'rgba(251,191,36,0.45)' }}>
        <BudgetBar event={event} compact />
      </Card>
      {over && helpNow && helpNow.result && helpNow.result.suggestions.length ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <T variant="label" muted>
            ✨ Ways to get back under budget
          </T>
          {helpNow.result.summary ? <T variant="small" muted>{helpNow.result.summary}</T> : null}
          {helpNow.result.suggestions.map((sug) => {
            const item = event.items.find((i) => i.id === sug.itemId);
            if (!item) return null;
            return (
              <Card key={sug.itemId} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <T variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
                    {item.emoji} {item.name}
                  </T>
                  <Tag>{money(itemTotal(item))}</Tag>
                </View>
                <T variant="small" muted style={{ marginTop: 4 }}>
                  {sug.why}
                </T>
                <View style={{ alignItems: 'flex-start', marginTop: 8 }}>
                  {sug.action === 'remove' ? (
                    <Button size="sm" variant="secondary" title="Remove it" onPress={() => remove(item)} />
                  ) : (
                    <Button size="sm" variant="secondary" title="Find a cheaper one" onPress={() => swap(item.id)} />
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
      <Gap h={20} />
      <View style={{ gap: 10 }}>
        {over && ai.enabled && !(helpNow && helpNow.result && helpNow.result.suggestions.length) ? (
          <Button
            title={helpNow && helpNow.loading ? 'Looking for savings…' : 'Help me get back under budget'}
            icon="✨"
            variant="secondary"
            disabled={!!(helpNow && helpNow.loading)}
            onPress={askForHelp}
            full
          />
        ) : null}
        <Button title="Undo that change" icon="↩︎" onPress={undo} full />
        <Button title="Review my plan" variant="secondary" onPress={review} full />
        <Button variant="tertiary" title={over ? 'Keep it anyway' : 'OK, got it'} onPress={dismissBudgetAlert} />
      </View>
      {over ? (
        <T variant="tiny" dim center style={{ marginTop: 6 }}>
          Tip: tap any item in your plan to swap it for something cheaper.
        </T>
      ) : null}
    </Sheet>
  );
}

