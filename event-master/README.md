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
npm test           # unit tests for the recommendation engine, memory and AI contract
npm run test:worker
npm run lint
```

## What's built

**Build Phase 1: core app**
- Splash and Welcome screens, with Start a party or Explore first.
- Explore Mode: ideas, browsing products, what Event Master can plan, an interactive demo of how it works, and an example party. Nothing in Explore creates a real event.
- Creating an event: what you're planning, then the essentials (venue, date, guests, budget, vibe), then which categories you want help with, then your Party Plan.
- One suggestion at a time, with Accept or Decline, a live budget, and a "Your party is ready!" screen with Save my party.
- **Budget alerts:** if any change takes a party exactly to its budget, or over it, a pop-up says so straight away and offers Undo that change, Review my plan, or Keep it.
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
- Editing guests, budget, vibe, categories, venue or date shows "⚠️ Your party has changed".
- **Review changes** then offers suggested quantity updates, an over-budget warning, and items that may no longer match your vibe. A new venue flags venue-dependent items such as the backdrop, lighting and activities, and a new date flags invitations.

**Venue planner (Phase 5, without a venue service)**
- Ranks 10 kinds of venue (home, park, hall, restaurant, activity centre, function room, studio, beach, pool, cinema) for the party's guests, budget, vibe and type. Each comes with what's good, what to watch for and questions to ask the venue. AI can personalise the ranking.
- A shortlist of real places *you* find, with capacity, hire cost, link, contact and notes. Each is tracked from Considering to Enquired, Confirmed available, Booked or Not available.
- **Event Master never checks or claims availability.** A venue shows as available only when you mark that the venue confirmed it. No venues are invented.
- Booking a venue sets it as the event's venue, and its hire cost counts toward the budget, so booking can raise a budget alert.

**Plans on every device (claude.ai)**
- On claude.ai, events, memory, saved ideas and settings sync to the viewer's private space in the artifact's database. Only that person can read it.
- For each event the newest version wins. Deletes reach every device. Data is also kept on the device, so the app works without sync.

**Responsive design**
- **Phone:** one column, bottom navigation, Accept and Decline pinned within thumb reach.
- **Tablet:** two-column layouts.
- **Desktop:** sidebar navigation, with the suggestion and the Party Plan side by side.

## ✨ AI features (Claude)

AI is optional. Without it, the app falls back to built-in rules. With it, the server sends structured requests to Claude (`claude-opus-5-5`). Every answer is checked against the app's own lists of colours, styles, vibes, shops and categories, so **AI can steer suggestions but can never invent products, prices or links**.

| Where | What AI does |
|---|---|
| **Every suggestion** | The rules first filter and rank real products, removing declined items, avoided shops, and colours, styles and prices you ruled out. Claude then picks the best fit from the top few, using everything known: your requests, declines and the reasons, your own words for the vibe, items already accepted, your profile (if you opted in for this event), saved ideas and party ideas. The card shows "✨" with why it was chosen. Claude can only choose from that list, and the result is cached so it only re-picks when something changes |
| Decline → "Something else" | Understands free-text feedback (for example "feels a bit much for little ones") and adapts the next suggestion |
| Suggestion → ✨ Ask Event Master | Requests like "something more elegant" or "no pink" steer the rest of the plan. Each shows as a chip you can tap to remove |
| Suggestion → ✨ Explain this pick | A friendlier explanation, written only from facts the app supplies |
| Create/edit an event | Event types and vibes in your own words ("70s disco") are matched to known vibes, colours and styles |
| Party Plan → ✨ Ideas for this party | Themes, activities and touches (ideas only, never products) that you can save |
| Profile → ✨ Tell me about your style | Turns a description into suggested memories. **You confirm each one** before it's saved |
| Profile → ✨ Summarise my style | A short summary of what's been learned |
| Event page → What I learned | Includes what AI understood from your feedback and requests |

**Privacy:** what you type, plus basic event details (type, vibe, guests, budget, categories), is sent. **Event names and venues are never sent.** You can switch AI off under Profile → "Use AI features".

**Memory still follows the spec:** AI never turns a single choice into a permanent preference. The rule of "repeats across 2+ saved events" still decides learned memories, and AI-suggested memories are added only after you confirm them.

## Deploying to Cloudflare Workers

The `worker/` folder holds one Cloudflare Worker that serves both the web app and the AI API. **The Anthropic API key lives only there**, as a secret.

```bash
cd event-master
npm run build:web                            # builds the web app into dist/
cd worker
npm install
npx wrangler login                           # once
npx wrangler secret put ANTHROPIC_API_KEY    # paste your Anthropic API key
npx wrangler deploy
```

- **Web:** open the `*.workers.dev` URL that `wrangler deploy` prints. The app finds the API on the same address automatically.
- **Phone apps:** set `EXPO_PUBLIC_API_URL=https://<your-worker>.workers.dev` before `npm start` or an EAS build, so the app knows where the API is.
- **Protection:** AI calls are limited to 20 per minute per IP address. Other websites can't call the API unless they're listed in `ALLOWED_ORIGINS` in `worker/wrangler.jsonc`. Request sizes are capped, and every input and output is validated.
- **Tests:** `npm run test:worker` checks the Worker using a fake Claude client, so no API key is needed.

## Not built yet

| Spec item | Why it's not built | What's needed |
|---|---|---|
| Phase 4: exact real products, photos and live prices | The spec says product facts must come from reliable structured sources. Suggestions are example items whose real-shop buttons search Kmart, BIG W, Officeworks, Woolworths, Amazon AU, eBay AU or Etsy | A product feed or shop API (e.g. an affiliate programme) |
| Phase 5: searching real venues and live availability | Needs a venue or availability service. The venue planner covers everything else | Which venue service to use |
| Supabase (accounts, security rules) | Needs a Supabase project. Sync currently works only on claude.ai | A Supabase project URL and key |

## How it's organised

```
App.js                     fonts, providers, routes, responsive shell
src/logic/engine.js        recommendation engine (pure functions, unit tested)
src/logic/memory.js        pattern-based long-term memory (unit tested)
src/logic/events.js        event creation and the example party
src/data/catalog.js        SAMPLE product catalogue, ~170 items (fictional shops, no links)
src/data/venues.js         kinds of venue, booking statuses, venue ranking
src/data/shops.js          real Australian shops and their search links (unit tested)
src/data/categories.js     categories, the parts of each category, vibes, event types
src/state/AppState.js      app state, saved on the device with AsyncStorage
src/state/sync.js          claude.ai cloud sync: merge rules (unit tested) and the db connection
src/state/Navigation.js    small stack navigator (supports Android back)
src/ai/contract.js         AI tasks: JSON schemas + output checks (shared with the Worker)
src/ai/client.js           calls the Worker, with a non-AI fallback for every feature
worker/                    Cloudflare Worker: serves the web build, /api/ai/* calls Claude
src/components/            brand (logo/wordmark), UI kit, plan components
src/screens/               all screens
```
