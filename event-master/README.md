# 🎉 Event Master

A personalised event-planning app that learns while you plan. It runs on iPhone, Android, iPad/tablets and desktop web from one Expo (React Native) codebase.

## Run it

```bash
cd event-master
npm install
npm start          # then scan the QR code with the Expo Go app on your phone
npm run web        # or open it in a browser
```

Other commands:

```bash
npm test           # unit tests for the recommendation engine and memory
npm run lint
```

## What's built

**Build Phase 1: core app**
- Splash and Welcome screens, with Start a party or Explore first.
- Explore Mode: ideas, browsing products, what Event Master can plan, an interactive demo of how it works, and an example party. Nothing in Explore creates a real event.
- Creating an event: what you're planning, then the essentials (venue, date, guests, budget, vibe), then which categories you want help with, then your Party Plan.
- One suggestion at a time, with Accept or Decline, a live budget, and a "Your party is ready!" screen with Save my party.
- Home screen for returning users, an Events list, an individual event page, Profile and Saved Ideas.

**Build Phase 2: smart planning**
- Declining asks why. Each reason changes the next suggestion:
  - **Too expensive:** cheaper.
  - **Don't like the colour:** a different colour.
  - **Don't like the style:** a different style.
  - **Wrong size/quantity:** a different pack size.
  - **Doesn't fit my theme:** a closer theme match.
  - **Don't like the shop:** avoids that shop for the rest of the event.
  - **I just don't like this option:** removes only that product.
  - **Something else:** free text, matched against simple keywords only.
- Accepted items shape later suggestions. For example, pink balloons lead to a purple star garland.
- Every suggestion explains *why it was suggested*.
- A category is complete only when all of its parts are resolved, by accepting, adding your own item, or skipping.
- Accepted items can be changed: find a replacement, or enter one you already have. **Changing an item is not treated as disliking it.** Items can also be removed, with an optional reason. A one-off removal is never remembered.

**Build Phase 3: memory**
- Learns patterns across saved events, such as colours, styles, vibes, shops chosen and avoided, budget range, event types, and cake or cupcakes.
- A preference becomes a memory only after it appears in at least **2 saved events**.
- The profile lets you view, add, change and forget memories, clear all memory, or turn memory off.
- When you start a new event, it offers "I've got a head start!" with the choice to use your memories or start fresh. Choices for the current event always win.

**Plan changes (part of Phase 6)**
- Editing guests, budget, vibe or categories shows "⚠️ Your party has changed".
- **Review changes** then offers suggested quantity updates, an over-budget warning, and items that may no longer match your vibe.

**Responsive design**
- **Phone:** one column, bottom navigation, Accept and Decline pinned within thumb reach.
- **Tablet:** two-column layouts.
- **Desktop:** sidebar navigation, with the suggestion and the Party Plan side by side.

## Not built yet

These need information or services that don't exist yet, so they were left out on purpose:

| Spec item | Why it's not built | What's needed |
|---|---|---|
| Phase 4: real products, images, prices and links | The spec says product facts must come from reliable structured sources, so none were invented | Which shops or product feeds to use |
| Phase 5: venue search | Needs a venue or availability service. "Find a venue" currently asks for the area you're looking in | Which venue service to use |
| Supabase (accounts, cloud sync, security rules) | Needs a Supabase project. Data currently stays on the device | A Supabase project URL and key |
| AI layer (understanding free text) | Needs an AI provider and API key, called from a server function | Provider choice and a server function |
| Date and venue change warnings | The current sample data doesn't depend on date or venue | Real venue and product availability |

## How it's organised

```
App.js                     fonts, providers, routes, responsive shell
src/logic/engine.js        recommendation engine (pure functions, unit tested)
src/logic/memory.js        pattern-based long-term memory (unit tested)
src/logic/events.js        event creation and the example party
src/data/catalog.js        SAMPLE product catalogue (fictional shops, no links)
src/data/categories.js     categories, the parts of each category, vibes, event types
src/state/AppState.js      app state, saved on the device with AsyncStorage
src/state/Navigation.js    small stack navigator (supports Android back)
src/components/            brand (logo/wordmark), UI kit, plan components
src/screens/               all screens
```
