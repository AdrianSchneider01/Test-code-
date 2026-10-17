import { useCallback } from 'react';

import { buildLearnInput } from '../ai/assist';
import { askAI } from '../ai/client';
import { useAI, useAppState } from '../state/AppState';

// Saves a party. With AI on, Claude then reviews the party in the background
// and its findings feed "What I learned" and the memory patterns.
export function useSaveParty() {
  const { saveParty, updateEvent } = useAppState();
  const ai = useAI();
  return useCallback(
    (event) => {
      saveParty(event.id);
      if (ai.enabled) {
        askAI('learn', buildLearnInput(event)).then((res) => res && updateEvent(event.id, (e) => ({ ...e, aiInsights: res })));
      }
    },
    [saveParty, updateEvent, ai.enabled],
  );
}
