<script lang="ts">
  import { onMount } from 'svelte';
  import { DAY_NAMES, dayKey, isoDate } from '../lib/dates';
  import { decodeShare, resolvePlan, upcoming, type Changes, type Local, type Mode, type Slot, type Week } from '../lib/plan';

  let { week, changes }: { week: Week; changes: Changes } = $props();

  const KEY = 'lfaq:today';
  let local = $state<Local>({});
  let now = $state(new Date());
  let editing = $state(false);
  let draft = $state<Slot>({});
  let shown: Slot = {}; // what the form started with
  let ready = $state(false);

  const plan = $derived(resolvePlan(now, week, changes, local));
  const date = $derived(isoDate(now));
  const heading = $derived(
    `${DAY_NAMES[dayKey(now)]} ${now.getDate()} ${now.toLocaleDateString('en-GB', { month: 'long' })}`,
  );
  // The week ahead: tomorrow up to the same weekday next week.
  const ahead = $derived(upcoming(now, 7, week, changes, local));
  const dayLabel = (d: Date, i: number) => (i === 0 ? 'Tomorrow' : `${DAY_NAMES[dayKey(d)]} ${d.getDate()}`);
  const modeChoice = $derived<'auto' | Mode>(local.mode ?? 'auto');

  onMount(() => {
    try { local = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { local = {}; }
    // A link from the grown-up page carries dated changes; keep them on this device, then tidy the address bar.
    const m = location.hash.match(/^#share=(.+)$/);
    const shared = m ? decodeShare(m[1]!) : null;
    if (shared) {
      local = {
        ...local,
        oneOffs: [...(local.oneOffs ?? []), ...(shared.oneOffs ?? [])],
        holidays: [...(local.holidays ?? []), ...(shared.holidays ?? [])],
        important: [...(local.important ?? []), ...(shared.important ?? [])],
        // A new "usual week" replaces the old one for the days it sets, and stays until changed.
        ...(shared.week ? { week: { school: { ...local.week?.school, ...shared.week.school }, holiday: { ...local.week?.holiday, ...shared.week.holiday } } } : {}),
      };
      history.replaceState(null, '', location.pathname);
    }
    // Forget overrides and one-offs from days gone by.
    const today = isoDate(new Date());
    const keep = <T extends { date: string }>(a?: T[]) => a?.filter((x) => x.date >= today);
    if (local.overrides) local.overrides = Object.fromEntries(Object.entries(local.overrides).filter(([d]) => d >= today));
    if (local.oneOffs) local.oneOffs = keep(local.oneOffs);
    if (local.holidays) local.holidays = local.holidays.filter((h) => h.to >= today);
    if (local.important) local.important = keep(local.important);
    ready = true;
    // Keep the date right if the page is left open past midnight.
    const t = window.setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(t);
  });

  $effect(() => {
    const snapshot = JSON.stringify(local);
    if (!ready) return;
    try { localStorage.setItem(KEY, snapshot); } catch { /* storage may be blocked */ }
  });

  const setMode = (m: 'auto' | Mode) => {
    const { mode: _drop, ...rest } = local;
    local = m === 'auto' ? rest : { ...rest, mode: m };
  };
  function startEdit() {
    shown = { headline: plan.headline ?? '', pickup: plan.pickup ?? '', activity: plan.activity ?? '' };
    draft = { ...shown };
    editing = true;
  }
  function save(e: SubmitEvent) {
    e.preventDefault();
    // Only keep what was actually changed, so the rest still follows School/Holiday mode.
    const clean: Slot = {};
    for (const k of ['headline', 'pickup', 'activity'] as const) {
      const v = draft[k]?.trim();
      if (v && v !== (shown[k] ?? '')) clean[k] = v.slice(0, 60);
    }
    local = { ...local, overrides: { ...(local.overrides ?? {}), [date]: clean } };
    editing = false;
  }
  function reset() {
    const o = { ...(local.overrides ?? {}) };
    delete o[date];
    local = { ...local, overrides: o };
    editing = false;
  }
  const cards = $derived(
    [
      plan.pickup ? { k: 'School pickup', v: plan.pickup } : null,
      plan.activity ? { k: 'After school', v: plan.activity } : null,
    ].filter((x): x is { k: string; v: string } => !!x),
  );
</script>

<p class="date">{heading}</p>
<div class="seg" role="group" aria-label="Which kind of day">
  {#each [['auto', 'Automatic'], ['school', 'School'], ['holiday', 'Holiday']] as [v, l]}
    <button type="button" class:on={modeChoice === v} aria-pressed={modeChoice === v} onclick={() => setMode(v as 'auto' | Mode)}>{l}</button>
  {/each}
</div>
{#if plan.holidayLabel && plan.mode === 'holiday'}<p class="tag">{plan.holidayLabel}</p>{/if}

<section class="today" aria-live="polite">
  <h2>{plan.headline ?? (plan.mode === 'holiday' ? 'Holiday!' : 'Today')}</h2>
  {#if cards.length}
    <div class="cards">
      {#each cards as c}
        <div class="card"><span>{c.k}</span><strong>{c.v}</strong></div>
      {/each}
    </div>
  {:else if !plan.headline}
    <p>Nothing planned.</p>
  {/if}
  {#each plan.notes as n}<p class="tag star">★ {n}</p>{/each}
  {#if plan.source !== 'default'}<p class="tag">Changed for today</p>{/if}
</section>

{#if editing}
  <form class="card edit" onsubmit={save}>
    <h2>Change today</h2>
    <label>What's happening?<input type="text" bind:value={draft.headline} maxlength="60" /></label>
    <label>School pickup<input type="text" bind:value={draft.pickup} maxlength="60" placeholder="e.g. 3:30" /></label>
    <label>After school<input type="text" bind:value={draft.activity} maxlength="60" placeholder="e.g. Dentist" /></label>
    <div class="row">
      <button class="btn blue small" type="submit">Save</button>
      <button class="btn ghost small" type="button" onclick={() => (editing = false)}>Cancel</button>
    </div>
  </form>
{:else}
  <div class="row">
    <button class="btn blue small" type="button" onclick={startEdit}>Change today</button>
    {#if local.overrides?.[date]}<button class="btn ghost small" type="button" onclick={reset}>Back to normal</button>{/if}
  </div>
{/if}

<h2 class="ahead">Coming up</h2>
<ul class="week">
  {#each ahead as a, i}
    <li class:important={a.plan.notes.length > 0}>
      <strong class="when">{dayLabel(a.d, i)}</strong>
      <span class="what">
        {#if a.plan.pickup}<span>Pickup {a.plan.pickup}</span>{/if}
        {#if a.plan.activity}<span>{a.plan.activity}</span>{/if}
        {#if !a.plan.pickup && !a.plan.activity}<span>{a.plan.headline ?? 'Nothing planned'}</span>{/if}
        {#each a.plan.notes as n}<span class="star">★ {n}</span>{/each}
      </span>
    </li>
  {/each}
</ul>

<style>
  .ahead { margin-top: 2rem; }
  .week { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
  .week li { display: flex; gap: 0.9rem; align-items: baseline; background: #fff; border: 2px solid var(--line); border-radius: 14px; padding: 0.55rem 0.9rem; }
  .week li.important { border-color: var(--red); }
  .when { flex: 0 0 8.5rem; color: var(--blue-dark); }
  .what { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; }
  .star { color: var(--red-dark); font-weight: 800; }
  .tag.star { color: #fff; }
  .date { font-weight: 800; color: var(--muted); margin: 0 0 0.6rem; }
  .seg { display: inline-flex; border: 3px solid var(--blue); border-radius: 999px; overflow: hidden; }
  .seg button { font: inherit; font-weight: 800; border: 0; background: #fff; color: var(--blue-dark); padding: 0.55rem 1rem; min-height: 44px; cursor: pointer; }
  .seg button.on { background: var(--blue); color: #fff; }
  .tag { display: inline-block; margin: 0.6rem 0 0; padding: 0.15rem 0.7rem; border-radius: 999px; background: var(--red); color: #fff; font-weight: 700; font-size: 0.9rem; }
  .today h2 { font-size: clamp(1.8rem, 7vw, 2.6rem); margin: 1rem 0 0.8rem; color: var(--red-dark); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
  .card span { display: block; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .card strong { font-size: 1.8rem; color: var(--blue-dark); }
  .edit { display: grid; gap: 0.7rem; margin-top: 1rem; }
  .edit h2 { margin: 0; }
  .edit label { display: grid; gap: 0.25rem; }
</style>
