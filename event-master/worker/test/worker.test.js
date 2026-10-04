import { describe, expect, test } from 'vitest';

import { TASKS } from '../../src/ai/contract.js';
import worker, { MODEL, handleApi } from '../src/index.js';
import { PROMPTS } from '../src/prompts.js';

const ENV = { ANTHROPIC_API_KEY: 'test-key', ALLOWED_ORIGINS: 'http://localhost:8081' };

// Fake Anthropic client: records the request and returns a canned message.
function fakeClient(reply, record = {}) {
  return () => ({
    beta: {
      messages: {
        create: async (params) => {
          record.params = params;
          if (reply instanceof Error) throw reply;
          return reply;
        },
      },
    },
  });
}

const textReply = (obj, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text: JSON.stringify(obj) }] });

function post(task, body, headers = {}) {
  return new Request(`https://em.example/api/ai/${task}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const product = { name: 'Pink Balloon Set', colour: 'pink', style: 'cute', retailer: 'Party Lane', lineTotal: 10 };

describe('every task has a prompt and a strict schema', () => {
  test.each(Object.keys(TASKS))('%s', (task) => {
    expect(PROMPTS[task]).toBeTruthy();
    const walk = (s) => {
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
        Object.values(s.properties).forEach(walk);
      }
      if (s.type === 'array') walk(s.items);
    };
    walk(TASKS[task].schema);
  });
});

describe('API', () => {
  test('health reports whether AI is configured', async () => {
    const res = await handleApi(new Request('https://em.example/api/health'), ENV);
    expect(await res.json()).toEqual({ ok: true, ai: true });
    const res2 = await handleApi(new Request('https://em.example/api/health'), {});
    expect(await res2.json()).toEqual({ ok: true, ai: false });
  });

  test('sends a structured-output request with fallbacks and returns sanitised JSON', async () => {
    const record = {};
    const reply = textReply({
      reasons: ['colour', 'made-up'],
      avoidColours: ['pink', 'neon'],
      preferColours: ['Purple'],
      preferStyles: [],
      preferVibes: ['elegant'],
      summary: 'Look for something softer',
    });
    const res = await handleApi(post('feedback', { note: 'too pink', product }), ENV, { makeClient: fakeClient(reply, record) });
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.reasons).toEqual(['colour']);
    expect(result.avoidColours).toEqual(['pink']);
    expect(result.preferColours).toEqual(['purple']);
    expect(record.params.model).toBe(MODEL);
    expect(record.params.fallbacks).toBe('default');
    expect(record.params.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(record.params.output_config.format).toEqual({ type: 'json_schema', schema: TASKS.feedback.schema });
    expect(record.params.system).toBe(PROMPTS.feedback);
    expect(JSON.parse(record.params.messages[0].content)).toEqual({ note: 'too pink', product });
  });

  test('ideas never return more than 6 and drop empty ideas', async () => {
    const ideas = Array.from({ length: 9 }, (_, i) => ({ emoji: '🎉', title: `Idea ${i}`, text: 'Do a thing', category: 'activities' }));
    ideas.push({ emoji: '', title: '', text: '', category: 'nope' });
    const res = await handleApi(post('ideas', { event: { type: 'birthday', vibes: ['fun'], guests: 10, budget: 200 } }), ENV, {
      makeClient: fakeClient(textReply({ ideas })),
    });
    const { result } = await res.json();
    expect(result.ideas).toHaveLength(6);
  });

  test('memories are filtered to known vocabulary', async () => {
    const res = await handleApi(post('memories', { text: 'I love gold and always shop at Glow & Co' }), ENV, {
      makeClient: fakeClient(
        textReply({
          memories: [
            { type: 'colour', value: 'Gold' },
            { type: 'shopLike', value: 'glow & co' },
            { type: 'shopLike', value: 'Amazon' },
            { type: 'colour', value: 'gold' },
            { type: 'note', value: 'Plans a month ahead' },
          ],
        }),
      ),
    });
    const { result } = await res.json();
    expect(result.memories).toEqual([
      { type: 'colour', value: 'gold' },
      { type: 'shopLike', value: 'Glow & Co' },
      { type: 'note', value: 'Plans a month ahead' },
    ]);
  });

  test('a pick outside the candidates sent is rejected (422)', async () => {
    const input = {
      event: { type: 'birthday', vibes: ['cute'], guests: 10, budget: 150 },
      context: { lookingFor: 'Decorations — Balloons', accepted: [], declined: [], requests: [], profile: [], savedIdeas: [], partyIdeas: [], remainingBudget: 150 },
      candidates: [
        { id: 'bal-pink-20', name: 'Pink Balloon Set', colour: 'pink', style: 'cute', retailer: 'Party Lane', packLabel: '20 balloons', lineTotal: 5, vibes: ['cute'], whyRules: [] },
        { id: 'bal-gold-confetti', name: 'Gold Confetti Balloons', colour: 'gold', style: 'classic', retailer: 'Party Lane', packLabel: '10 balloons', lineTotal: 18, vibes: ['elegant'], whyRules: [] },
      ],
    };
    const bad = await handleApi(post('pick', input), ENV, { makeClient: fakeClient(textReply({ choiceId: 'made-up-item', reason: 'x' })) });
    expect(bad.status).toBe(422);
    const good = await handleApi(post('pick', input), ENV, { makeClient: fakeClient(textReply({ choiceId: 'bal-gold-confetti', reason: 'Elegant' })) });
    expect((await good.json()).result).toEqual({ choiceId: 'bal-gold-confetti', reason: 'Elegant' });
  });

  test('refusal and truncated output become 422', async () => {
    const r1 = await handleApi(post('vibe', { text: 'x' }), ENV, { makeClient: fakeClient({ stop_reason: 'refusal', content: [] }) });
    expect(r1.status).toBe(422);
    const r2 = await handleApi(post('vibe', { text: 'x' }), ENV, { makeClient: fakeClient({ stop_reason: 'max_tokens', content: [] }) });
    expect(r2.status).toBe(422);
  });

  test('rejects bad input, unknown tasks, big bodies and missing key', async () => {
    const mk = { makeClient: fakeClient(textReply({})) };
    expect((await handleApi(post('feedback', { note: '' , product }), ENV, mk)).status).toBe(400);
    expect((await handleApi(post('feedback', '{oops'), ENV, mk)).status).toBe(400);
    expect((await handleApi(post('hack', {}), ENV, mk)).status).toBe(404);
    expect((await handleApi(post('vibe', { text: 'a'.repeat(30000) }), ENV, mk)).status).toBe(413);
    expect((await handleApi(post('vibe', { text: 'ok' }), {}, mk)).status).toBe(503);
  });

  test('blocks other websites but allows same-origin, listed origins and native apps', async () => {
    const mk = { makeClient: fakeClient(textReply({ vibes: [], colours: [], styles: [], summary: '' })) };
    expect((await handleApi(post('vibe', { text: 'x' }, { Origin: 'https://evil.example' }), ENV, mk)).status).toBe(403);
    expect((await handleApi(post('vibe', { text: 'x' }, { Origin: 'https://em.example' }), ENV, mk)).status).toBe(200);
    const listed = await handleApi(post('vibe', { text: 'x' }, { Origin: 'http://localhost:8081' }), ENV, mk);
    expect(listed.status).toBe(200);
    expect(listed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
    expect((await handleApi(post('vibe', { text: 'x' }), ENV, mk)).status).toBe(200);
  });

  test('rate limiter is applied per IP', async () => {
    const env = { ...ENV, AI_LIMITER: { limit: async () => ({ success: false }) } };
    const res = await handleApi(post('vibe', { text: 'x' }), env, { makeClient: fakeClient(textReply({})) });
    expect(res.status).toBe(429);
  });

  test('non-API paths are served from static assets', async () => {
    const env = { ASSETS: { fetch: async () => new Response('<html>app</html>') } };
    const res = await worker.fetch(new Request('https://em.example/events'), env);
    expect(await res.text()).toBe('<html>app</html>');
  });
});
