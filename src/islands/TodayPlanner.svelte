<script lang="ts">
  import { onMount } from 'svelte';
  import { DAY_NAMES, dayKey, isoDate } from '../lib/dates';
  import { decodeShare, resolvePlan, upcoming, type Changes, type Local, type Mode, type Resolved, type Slot, type Week } from '../lib/plan';

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
  // The week ahead, starting tomorrow. Tomorrow gets its own big card; the other six days sit in a list below.
  const ahead = $derived(upcoming(now, 7, week, changes, local));
  const tomorrow = $derived(ahead[0]!);
  const later = $derived(ahead.slice(1));
  const longDate = (d: Date) => `${DAY_NAMES[dayKey(d)]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
  const dayLabel = (d: Date) => `${DAY_NAMES[dayKey(d)]} ${d.getDate()}`;
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
</script>

{#snippet dayCard(kind: 'today' | 'tomorrow', label: string, d: Date, p: Resolved)}
  <section class={`day ${kind}`}>
    <p class="pill">{label}</p>
    <p class="when2">{longDate(d)}</p>
    <h2>{p.headline ?? (p.mode === 'holiday' ? 'Holiday!' : label)}</h2>
    {#if p.pickup || p.activity}
      <dl>
        {#if p.pickup}<div><dt>Pickup</dt><dd>{p.pickup}</dd></div>{/if}
        {#if p.activity}<div><dt>After school</dt><dd>{p.activity}</dd></div>{/if}
      </dl>
    {:else if !p.headline}
      <p>Nothing planned.</p>
    {/if}
    {#each p.notes as n}<p class="tag star">★ {n}</p>{/each}
    {#if p.source !== 'default'}<p class="tag">Changed</p>{/if}
  </section>
{/snippet}

<div class="seg" role="group" aria-label="Which kind of day">
  {#each [['auto', 'Automatic'], ['school', 'School'], ['holiday', 'Holiday']] as [v, l]}
    <button type="button" class:on={modeChoice === v} aria-pressed={modeChoice === v} onclick={() => setMode(v as 'auto' | Mode)}>{l}</button>
  {/each}
</div>
{#if plan.holidayLabel && plan.mode === 'holiday'}<p class="tag">{plan.holidayLabel}</p>{/if}

<div class="pair" aria-live="polite">
  {@render dayCard('today', 'Today', now, plan)}
  {@render dayCard('tomorrow', 'Tomorrow', tomorrow.d, tomorrow.plan)}
</div>

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
  {#each later as a}
    <li class:important={a.plan.notes.length > 0}>
      <strong class="when">{dayLabel(a.d)}</strong>
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
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0; }
  .day { background: #fff; border: 4px solid var(--red); border-radius: var(--radius); padding: 0.9rem 1.1rem 1.1rem; }
  .day.tomorrow { border-color: var(--blue); }
  .pill { display: inline-block; margin: 0; padding: 0.1rem 0.9rem; border-radius: 999px; background: var(--red); color: #fff; font-weight: 900; font-size: 1.05rem; letter-spacing: 0.06em; text-transform: uppercase; }
  .tomorrow .pill { background: var(--blue); }
  .when2 { margin: 0.4rem 0 0; font-weight: 700; color: var(--muted); }
  .day h2 { font-size: clamp(1.5rem, 6vw, 2rem); margin: 0.1rem 0 0.6rem; color: var(--red-dark); }
  .tomorrow h2 { color: var(--blue-dark); }
  dl { margin: 0; display: grid; gap: 0.5rem; }
  dl div { display: grid; gap: 0; }
  dt { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  dd { margin: 0; font-size: clamp(1.6rem, 7vw, 2.2rem); font-weight: 900; line-height: 1.1; color: var(--ink); }
  .ahead { margin-top: 2rem; }
  .week { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
  .week li { display: flex; gap: 0.9rem; align-items: baseline; background: #fff; border: 2px solid var(--line); border-radius: 14px; padding: 0.55rem 0.9rem; }
  .week li.important { border-color: var(--red); }
  .when { flex: 0 0 8.5rem; color: var(--blue-dark); }
  .what { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; }
  .star { color: var(--red-dark); font-weight: 800; }
  .tag.star { color: #fff; }
  .seg { display: inline-flex; border: 3px solid var(--blue); border-radius: 999px; overflow: hidden; }
  .seg button { font: inherit; font-weight: 800; border: 0; background: #fff; color: var(--blue-dark); padding: 0.55rem 1rem; min-height: 44px; cursor: pointer; }
  .seg button.on { background: var(--blue); color: #fff; }
  .tag { display: inline-block; margin: 0.6rem 0 0; padding: 0.15rem 0.7rem; border-radius: 999px; background: var(--red); color: #fff; font-weight: 700; font-size: 0.9rem; }
  .edit { display: grid; gap: 0.7rem; margin-top: 1rem; }
  .edit h2 { margin: 0; }
  .edit label { display: grid; gap: 0.25rem; }
</style>
