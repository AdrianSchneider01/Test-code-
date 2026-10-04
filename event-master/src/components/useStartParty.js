import { useCallback } from 'react';

import { newDraft } from '../logic/events';
import { useAppState, useMemories } from '../state/AppState';
import { useNav } from '../state/Navigation';

// Starts a brand-new party. Returning users with memories first see the
// "I've got a head start!" prompt.
export function useStartParty() {
  const nav = useNav();
  const { memory, startDraft } = useAppState();
  const memories = useMemories();
  return useCallback(() => {
    if (memory.enabled && memories.length) {
      nav.navigate('memoryPrompt');
    } else {
      startDraft(newDraft());
      nav.navigate('plan1');
    }
  }, [memory.enabled, memories.length, nav, startDraft]);
}
