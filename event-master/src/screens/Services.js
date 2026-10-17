import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { FadeIn } from '../components/Effects';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Field, Gap, SectionTitle, Sheet, T, Tag, useToast } from '../components/ui';
import { getCategory } from '../data/categories';
import { SERVICE_STATUSES, SERVICE_TYPES, getServiceType, mapsSearchUrl, rankServiceTypes } from '../data/services';
import { applyAddService, applyRemoveService, applyServiceArea, applyServiceStatus, applyUpdateService, serviceArea, serviceShortlist } from '../logic/engine';
import { money } from '../logic/util';
import { useAppState, useEvent } from '../state/AppState';
import { useNav } from '../state/Navigation';
import { colors } from '../theme';
import { MissingEvent } from './Planning';

const EMPTY_FORM = { name: '', typeId: null, quote: '', link: '', contact: '', notes: '' };
const open = (url) => Linking.openURL(url).catch(() => {});

function ServiceTypeCard({ type, area, onAdd }) {
  return (
    <Card>
      <T variant="h3">
        {type.emoji} {type.name}
      </T>
      <T variant="small" muted style={{ marginTop: 4 }}>
        For: {getCategory(type.category).name}
      </T>
      <View style={[styles.tags, { marginTop: 10 }]}>
        <Button
          size="sm"
          variant="secondary"
          icon="🗺️"
          title={area ? `Find near ${area} ↗` : 'Set your area first'}
          disabled={!area}
          onPress={() => open(mapsSearchUrl(type, area))}
          accessibilityLabel={`Search Google Maps for ${type.name}${area ? ` near ${area}` : ''}`}
        />
      </View>
      <Button variant="tertiary" size="sm" title="Add one to my shortlist" icon="＋" onPress={onAdd} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 }} />
    </Card>
  );
}

function ShortlistCard({ service, onStatus, onEdit, onRemove }) {
  const type = getServiceType(service.typeId);
  const status = SERVICE_STATUSES.find((s) => s.id === service.status);
  return (
    <Card style={service.status === 'booked' ? { borderColor: colors.success } : null}>
      <View style={styles.rowBetween}>
        <T variant="h3" style={{ flex: 1 }} numberOfLines={2}>
          {type ? `${type.emoji} ` : ''}
          {service.name}
        </T>
        <Tag color={service.status === 'booked' ? colors.success : colors.textMuted} bg="rgba(255,255,255,0.06)">
          {status.emoji} {status.label}
        </Tag>
      </View>
      <T variant="small" muted style={{ marginTop: 4 }}>
        {type ? type.name : 'Kind of service not set'}
      </T>
      <View style={styles.tags}>{service.quote != null ? <Tag>Quote {money(service.quote)}</Tag> : <Tag>No quote yet</Tag>}</View>
      {service.contact ? (
        <T variant="small" style={{ marginTop: 8 }} selectable>
          ☎️ {service.contact}
        </T>
      ) : null}
      {service.notes ? (
        <T variant="small" muted style={{ marginTop: 4 }}>
          📝 {service.notes}
        </T>
      ) : null}
      {service.link ? <Button variant="tertiary" size="sm" title="Open website ↗" onPress={() => open(service.link)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}
      <T variant="label" dim style={{ marginTop: 10, marginBottom: 6 }}>
        Status
      </T>
      <View style={styles.tags}>
        {SERVICE_STATUSES.map((s) => (
          <Chip key={s.id} small emoji={s.emoji} label={s.id === 'booked' && service.status !== 'booked' ? 'Book it' : s.label} selected={service.status === s.id} onPress={() => onStatus(s.id)} />
        ))}
      </View>
      <View style={[styles.rowBetween, { marginTop: 8 }]}>
        <Button variant="tertiary" size="sm" title="Edit" onPress={onEdit} />
        <Button variant="tertiary" size="sm" title="Remove" onPress={onRemove} />
      </View>
    </Card>
  );
}

export function ServicesScreen() {
  const nav = useNav();
  const event = useEvent(nav.route.params.eventId);
  const { updateEvent } = useAppState();
  const toast = useToast();
  const [form, setForm] = useState(null); // { id?, ...fields }
  const [areaText, setAreaText] = useState(() => (event ? serviceArea(event) : ''));
  const [showAll, setShowAll] = useState(false);
  if (!event) return <MissingEvent />;

  const area = serviceArea(event);
  const shortlist = serviceShortlist(event);
  const booked = shortlist.filter((sv) => sv.status === 'booked');
  // Opened from one part of the plan (e.g. "Main activity") → those services first.
  const focus = nav.route.params.slotId ? SERVICE_TYPES.filter((t) => t.slot === nav.route.params.slotId && t.category === nav.route.params.categoryId) : [];
  const ranked = rankServiceTypes(event);
  const ordered = [...focus, ...ranked.filter((r) => r.suggested && !focus.includes(r.type)).map((r) => r.type)];
  const visible = showAll ? [...ordered, ...SERVICE_TYPES.filter((t) => !ordered.includes(t))] : ordered;
  const questions = shortlist
    .flatMap((sv) => (getServiceType(sv.typeId) ? getServiceType(sv.typeId).ask : []))
    .filter((q, i, all) => all.indexOf(q) === i);

  const saveArea = () => {
    updateEvent(event.id, (e) => applyServiceArea(e, areaText));
    toast(areaText.trim() ? `📍 Searching near ${areaText.trim()}` : 'Area cleared');
  };

  const save = () => {
    if (!form.name.trim() || !form.typeId) return;
    if (form.id) updateEvent(event.id, (e) => applyUpdateService(e, form.id, form));
    else updateEvent(event.id, (e) => applyAddService(e, form));
    toast(form.id ? '✓ Updated' : '✓ Added to your shortlist');
    setForm(null);
  };

  const setStatus = (sv, status) => {
    updateEvent(event.id, (e) => applyServiceStatus(e, sv.id, status));
    if (status === 'booked') toast(`📌 ${sv.name} booked${sv.quote ? ` — ${money(sv.quote)} added to your plan` : ' — add the quote so it counts in your budget'}`);
  };

  return (
    <Screen title="Hire services">
      <FadeIn>
        <T variant="display">🎪 Hire services</T>
        <T muted style={{ marginTop: 6 }}>
          Find real local businesses, shortlist them and track quotes. Booked services join your plan at their quote.
        </T>
      </FadeIn>

      <Card style={{ marginTop: 18 }}>
        <T variant="h3">📍 Where is the party?</T>
        <T variant="small" muted style={{ marginTop: 4, marginBottom: 10 }}>
          Your suburb or town, so searches show businesses near you.
        </T>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <Field style={{ flex: 1 }} label="Suburb or town" value={areaText} onChangeText={setAreaText} placeholder="e.g. Parramatta" autoCapitalize="words" onSubmitEditing={saveArea} />
          <Button size="md" variant="secondary" title="Set" onPress={saveArea} disabled={areaText.trim() === area} />
        </View>
      </Card>

      {booked.length ? (
        <Card style={{ marginTop: 12, borderColor: colors.success }}>
          <T variant="h3">📌 Booked</T>
          {booked.map((sv) => (
            <T key={sv.id} variant="small" muted style={{ marginTop: 4 }}>
              {sv.name} — {sv.quote != null ? `${money(sv.quote)} in your plan` : 'add the quote so it counts in your budget'}
            </T>
          ))}
        </Card>
      ) : null}

      <Gap h={24} />
      <SectionTitle right={<Button variant="tertiary" size="sm" title="Add a business" icon="＋" onPress={() => setForm({ ...EMPTY_FORM, typeId: focus[0] ? focus[0].id : null })} />}>
        Your shortlist
      </SectionTitle>
      {shortlist.length ? (
        <View style={{ gap: 12 }}>
          {shortlist.map((sv) => (
            <ShortlistCard
              key={sv.id}
              service={sv}
              onStatus={(st) => setStatus(sv, st)}
              onEdit={() => setForm({ ...EMPTY_FORM, ...sv, quote: sv.quote != null ? String(sv.quote) : '' })}
              onRemove={() => {
                updateEvent(event.id, (e) => applyRemoveService(e, sv.id));
                toast('Removed from your shortlist');
              }}
            />
          ))}
        </View>
      ) : (
        <Card>
          <T muted>Nothing shortlisted yet. Search for a kind of service below, then add the businesses you like.</T>
        </Card>
      )}

      <Gap h={24} />
      <SectionTitle>{focus.length ? 'Services for this part of your party' : 'Services for your party'}</SectionTitle>
      <T variant="tiny" dim style={{ marginBottom: 10 }}>
        Searches open Google Maps, which shows real businesses near you with reviews, websites and phone numbers. Event Master doesn’t check prices or availability — ask for a quote.
      </T>
      <View style={{ gap: 12 }}>
        {visible.map((t) => (
          <ServiceTypeCard key={t.id} type={t} area={area} onAdd={() => setForm({ ...EMPTY_FORM, typeId: t.id })} />
        ))}
      </View>
      {!showAll ? <Button variant="tertiary" title={`Show all ${SERVICE_TYPES.length} kinds`} onPress={() => setShowAll(true)} /> : null}

      {questions.length ? (
        <>
          <Gap h={24} />
          <SectionTitle>Questions to ask before booking</SectionTitle>
          <Card>
            {questions.slice(0, 12).map((q) => (
              <T key={q} variant="small" style={{ marginBottom: 6 }}>
                ✦ {q}
              </T>
            ))}
          </Card>
        </>
      ) : null}

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form && form.id ? 'Edit business' : 'Add a business'} subtitle="Add a real business you’ve found. Fill in the quote when you hear back.">
        {form ? (
          <View style={{ gap: 12 }}>
            <Field label="Business name *" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="As shown on Google Maps or their website" />
            <View>
              <T variant="small" muted style={{ marginBottom: 8 }}>
                Kind of service *
              </T>
              <View style={styles.tags}>
                {SERVICE_TYPES.map((t) => (
                  <Chip key={t.id} small emoji={t.emoji} label={t.name} selected={form.typeId === t.id} onPress={() => setForm((f) => ({ ...f, typeId: t.id }))} />
                ))}
              </View>
            </View>
            <Field label="Quote" prefix="$" value={form.quote} onChangeText={(t) => setForm((f) => ({ ...f, quote: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            <Field label="Website (optional)" value={form.link} onChangeText={(link) => setForm((f) => ({ ...f, link }))} autoCapitalize="none" keyboardType="url" />
            <Field label="Phone or email (optional)" value={form.contact} onChangeText={(contact) => setForm((f) => ({ ...f, contact }))} autoCapitalize="none" />
            <Field label="Notes (optional)" value={form.notes} onChangeText={(notes) => setForm((f) => ({ ...f, notes }))} multiline />
            <Button title={form.id ? 'Save changes' : 'Add to shortlist'} onPress={save} disabled={!form.name.trim() || !form.typeId} full />
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
