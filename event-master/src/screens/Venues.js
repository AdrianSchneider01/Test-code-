import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { askAI, eventInfo } from '../ai/client';
import { FadeIn } from '../components/Effects';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Field, Gap, SectionTitle, Sheet, T, Tag, useToast } from '../components/ui';
import { VENUE_STATUSES, VENUE_TYPES, getVenueType, rankVenueTypes } from '../data/venues';
import { applyAddVenue, applyRemoveVenue, applyUpdateVenue, applyVenueStatus, bookedVenue, venueShortlist } from '../logic/engine';
import { money } from '../logic/util';
import { useAI, useAppState, useEvent } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { colors } from '../theme';
import { MissingEvent, Thinking } from './Planning';

const EMPTY_FORM = { name: '', area: '', typeId: null, capacity: '', cost: '', link: '', contact: '', notes: '' };

function VenueTypeCard({ ranked, aiWhy, onAdd }) {
  const v = ranked.type;
  return (
    <Card>
      <View style={styles.rowBetween}>
        <T variant="h3" style={{ flex: 1 }}>
          {v.emoji} {v.name}
        </T>
      </View>
      <View style={styles.tags}>
        <Tag>{v.setting === 'both' ? 'Indoor or outdoor' : v.setting === 'indoor' ? 'Indoor' : 'Outdoor'}</Tag>
        <Tag>
          {v.capacity[0]}–{v.capacity[1]} guests
        </Tag>
        <Tag>Cost: {v.cost}</Tag>
        {!ranked.fits ? (
          <Tag color={colors.warning} bg="rgba(251,191,36,0.1)">
            Check size
          </Tag>
        ) : null}
      </View>
      {aiWhy ? (
        <T variant="small" style={{ marginTop: 8 }}>
          ✨ {aiWhy}
        </T>
      ) : ranked.reasons.length ? (
        <T variant="small" muted style={{ marginTop: 8 }}>
          {ranked.reasons.join(' · ')}
        </T>
      ) : null}
      <T variant="small" muted style={{ marginTop: 6 }}>
        👍 {v.good}
      </T>
      <T variant="small" muted style={{ marginTop: 2 }}>
        👀 {v.watch}
      </T>
      <Button variant="tertiary" size="sm" title="Add one to my shortlist" icon="＋" onPress={onAdd} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 }} />
    </Card>
  );
}

function ShortlistCard({ venue, guests, onStatus, onEdit, onRemove }) {
  const type = getVenueType(venue.typeId);
  const tooSmall = venue.capacity != null && venue.capacity < guests;
  const status = VENUE_STATUSES.find((s) => s.id === venue.status);
  return (
    <Card style={venue.status === 'booked' ? { borderColor: colors.success } : null}>
      <View style={styles.rowBetween}>
        <T variant="h3" style={{ flex: 1 }} numberOfLines={2}>
          {type ? `${type.emoji} ` : '📍 '}
          {venue.name}
        </T>
        <Tag color={venue.status === 'booked' || venue.status === 'available' ? colors.success : colors.textMuted} bg="rgba(255,255,255,0.06)">
          {status.emoji} {status.label}
        </Tag>
      </View>
      <T variant="small" muted style={{ marginTop: 4 }}>
        {[venue.area, type ? type.name : null].filter(Boolean).join(' · ') || 'No details yet'}
      </T>
      <View style={styles.tags}>
        {venue.cost != null ? <Tag>Hire {money(venue.cost)}</Tag> : <Tag>Hire cost not set</Tag>}
        {venue.capacity != null ? (
          <Tag color={tooSmall ? colors.danger : colors.textMuted} bg={tooSmall ? 'rgba(248,113,113,0.1)' : undefined}>
            {tooSmall ? `⚠️ Fits ${venue.capacity}, you have ${guests}` : `Fits ${venue.capacity}`}
          </Tag>
        ) : null}
      </View>
      {venue.contact ? (
        <T variant="small" style={{ marginTop: 8 }} selectable>
          ☎️ {venue.contact}
        </T>
      ) : null}
      {venue.notes ? (
        <T variant="small" muted style={{ marginTop: 4 }}>
          📝 {venue.notes}
        </T>
      ) : null}
      {venue.link ? <Button variant="tertiary" size="sm" title="Open website ↗" onPress={() => Linking.openURL(venue.link).catch(() => {})} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}
      <T variant="label" dim style={{ marginTop: 10, marginBottom: 6 }}>
        Status
      </T>
      <View style={styles.tags}>
        {VENUE_STATUSES.map((s) => (
          <Chip key={s.id} small emoji={s.emoji} label={s.id === 'booked' && venue.status !== 'booked' ? 'Book it' : s.label} selected={venue.status === s.id} onPress={() => onStatus(s.id)} />
        ))}
      </View>
      <View style={[styles.rowBetween, { marginTop: 8 }]}>
        <Button variant="tertiary" size="sm" title="Edit" onPress={onEdit} />
        <Button variant="tertiary" size="sm" title="Remove" onPress={onRemove} />
      </View>
    </Card>
  );
}

export function VenuesScreen() {
  const nav = useNav();
  const event = useEvent(nav.route.params.eventId);
  const { updateEvent } = useAppState();
  const ai = useAI();
  const toast = useToast();
  const [form, setForm] = useState(null); // { id?, ...fields }
  const [setting, setSetting] = useState('either');
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (!event) return <MissingEvent />;

  const shortlist = venueShortlist(event);
  const booked = bookedVenue(event);
  let ranked = rankVenueTypes(event);
  if (advice && advice.ideas.length) {
    const order = advice.ideas.map((i) => i.typeId);
    ranked = [...ranked.filter((r) => order.includes(r.type.id)).sort((a, b) => order.indexOf(a.type.id) - order.indexOf(b.type.id)), ...ranked.filter((r) => !order.includes(r.type.id))];
  }
  const visible = showAll ? ranked : ranked.slice(0, advice && advice.ideas.length ? advice.ideas.length : 3);
  const questions = [
    ...((advice && advice.questions) || []),
    ...shortlist.flatMap((v) => (getVenueType(v.typeId) ? getVenueType(v.typeId).ask : [])),
  ].filter((q, i, all) => all.indexOf(q) === i);

  const personalise = async () => {
    setLoading(true);
    const res = await askAI('venueAdvice', { event: eventInfo(event), setting });
    setLoading(false);
    if (res && res.ideas.length) setAdvice(res);
    else toast('I couldn’t reach Event Master’s AI — please try again');
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (form.id) updateEvent(event.id, (e) => applyUpdateVenue(e, form.id, form));
    else updateEvent(event.id, (e) => applyAddVenue(e, form));
    toast(form.id ? '✓ Venue updated' : '✓ Added to your shortlist');
    setForm(null);
  };

  const setStatus = (venue, status) => {
    updateEvent(event.id, (e) => applyVenueStatus(e, venue.id, status));
    if (status === 'booked') toast(`📌 ${venue.name} is your venue${venue.cost ? ` — ${money(venue.cost)} added to your budget` : ''}`);
  };

  return (
    <Screen title="Venue planner">
      <FadeIn>
        <T variant="display">📍 Find your venue</T>
        <T muted style={{ marginTop: 6 }}>
          {event.guests} guests{event.venue && event.venue.mode === 'search' && event.venue.name ? ` · looking in ${event.venue.name}` : ''}
          {event.budget != null ? ` · ${money(event.budget)} budget` : ''}
        </T>
      </FadeIn>

      <Card style={{ marginTop: 18, borderColor: booked ? colors.success : colors.border }}>
        {booked ? (
          <>
            <T variant="h3">📌 Booked: {booked.name}</T>
            <T variant="small" muted style={{ marginTop: 4 }}>
              {booked.cost ? `${money(booked.cost)} hire is included in your party total.` : 'Add the hire cost so it counts in your budget.'}
            </T>
          </>
        ) : (
          <>
            <T variant="h3">Still looking</T>
            <T variant="small" muted style={{ marginTop: 4 }}>
              Add venues you find to your shortlist, then track each one from enquiry to booking.
            </T>
          </>
        )}
        <T variant="tiny" dim style={{ marginTop: 10 }}>
          Event Master doesn’t check availability. A venue only shows as available once you mark that they’ve confirmed it.
        </T>
      </Card>

      <Gap h={24} />
      <SectionTitle right={<Button variant="tertiary" size="sm" title="Add a venue" icon="＋" onPress={() => setForm({ ...EMPTY_FORM, area: event.venue && event.venue.mode === 'search' ? event.venue.name : '' })} />}>
        Your shortlist
      </SectionTitle>
      {shortlist.length ? (
        <View style={{ gap: 12 }}>
          {shortlist.map((v) => (
            <ShortlistCard
              key={v.id}
              venue={v}
              guests={event.guests}
              onStatus={(st) => setStatus(v, st)}
              onEdit={() => setForm({ ...EMPTY_FORM, ...v, capacity: v.capacity != null ? String(v.capacity) : '', cost: v.cost != null ? String(v.cost) : '' })}
              onRemove={() => {
                updateEvent(event.id, (e) => applyRemoveVenue(e, v.id));
                toast('Removed from your shortlist');
              }}
            />
          ))}
        </View>
      ) : (
        <Card>
          <T muted>No venues yet. Pick a kind of venue below, then add the real places you find.</T>
        </Card>
      )}

      <Gap h={24} />
      <SectionTitle>Kinds of venue that suit your party</SectionTitle>
      {ai.enabled ? (
        <Card style={{ marginBottom: 12 }}>
          <T variant="small" muted style={{ marginBottom: 10 }}>
            Indoors or outdoors?
          </T>
          <View style={styles.tags}>
            {[
              ['either', 'Either'],
              ['indoor', 'Indoor'],
              ['outdoor', 'Outdoor'],
            ].map(([id, label]) => (
              <Chip key={id} small label={label} selected={setting === id} onPress={() => setSetting(id)} />
            ))}
          </View>
          <Gap h={12} />
          {loading ? (
            <Thinking label="Thinking about venues for your party…" />
          ) : (
            <Button title={advice ? 'Ask again' : 'Personalise with AI'} icon="✨" size="sm" variant="secondary" onPress={personalise} style={{ alignSelf: 'flex-start' }} />
          )}
          {advice && advice.tip ? (
            <T variant="small" style={{ marginTop: 10 }}>
              ✨ {advice.tip}
            </T>
          ) : null}
        </Card>
      ) : null}
      <View style={{ gap: 12 }}>
        {visible.map((r) => (
          <VenueTypeCard
            key={r.type.id}
            ranked={r}
            aiWhy={advice ? (advice.ideas.find((i) => i.typeId === r.type.id) || {}).why : null}
            onAdd={() => setForm({ ...EMPTY_FORM, typeId: r.type.id, area: event.venue && event.venue.mode === 'search' ? event.venue.name : '' })}
          />
        ))}
      </View>
      {!showAll ? <Button variant="tertiary" title={`Show all ${VENUE_TYPES.length} kinds`} onPress={() => setShowAll(true)} /> : null}

      {questions.length ? (
        <>
          <Gap h={24} />
          <SectionTitle>Questions to ask before booking</SectionTitle>
          <Card>
            {questions.slice(0, 10).map((q) => (
              <T key={q} variant="small" style={{ marginBottom: 6 }}>
                ✦ {q}
              </T>
            ))}
          </Card>
        </>
      ) : null}

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form && form.id ? 'Edit venue' : 'Add a venue'} subtitle="Add a real place you’ve found. You can fill in more as you hear back.">
        {form ? (
          <View style={{ gap: 12 }}>
            <Field label="Venue name *" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="e.g. Bondi Pavilion" />
            <Field label="Area or suburb" value={form.area} onChangeText={(area) => setForm((f) => ({ ...f, area }))} />
            <View>
              <T variant="small" muted style={{ marginBottom: 8 }}>
                Kind of venue
              </T>
              <View style={styles.tags}>
                {VENUE_TYPES.map((v) => (
                  <Chip key={v.id} small emoji={v.emoji} label={v.name.split(' (')[0]} selected={form.typeId === v.id} onPress={() => setForm((f) => ({ ...f, typeId: f.typeId === v.id ? null : v.id }))} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field style={{ flex: 1 }} label="Fits how many?" value={form.capacity} onChangeText={(t) => setForm((f) => ({ ...f, capacity: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
              <Field style={{ flex: 1 }} label="Hire cost" prefix="$" value={form.cost} onChangeText={(t) => setForm((f) => ({ ...f, cost: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            </View>
            <Field label="Website (optional)" value={form.link} onChangeText={(link) => setForm((f) => ({ ...f, link }))} autoCapitalize="none" keyboardType="url" />
            <Field label="Phone or email (optional)" value={form.contact} onChangeText={(contact) => setForm((f) => ({ ...f, contact }))} autoCapitalize="none" />
            <Field label="Notes (optional)" value={form.notes} onChangeText={(notes) => setForm((f) => ({ ...f, notes }))} multiline />
            <Button title={form.id ? 'Save changes' : 'Add to shortlist'} onPress={save} disabled={!form.name.trim()} full />
            <Button variant="tertiary" title="Cancel" onPress={() => setForm(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
});
