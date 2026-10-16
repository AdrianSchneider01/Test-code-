import { View } from 'react-native';

import { isPlanComplete } from '../logic/engine';
import { money } from '../logic/util';
import { useAppState, useEvent } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { BudgetBar } from './Plan';
import { Button, Card, Gap, Sheet, T, useToast } from './ui';

// Pops up on any screen when a change takes a party up to, or over, its budget.
export function BudgetAlert() {
  const { budgetAlert: alert, dismissBudgetAlert, restoreEvent } = useAppState();
  const event = useEvent(alert ? alert.eventId : null);
  const nav = useNav();
  const toast = useToast();
  if (!alert || !event) return null;

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
      <Gap h={20} />
      <View style={{ gap: 10 }}>
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

