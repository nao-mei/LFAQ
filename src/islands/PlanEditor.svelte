<script lang="ts">
  import { onMount } from 'svelte';
  import { DAY_NAMES, dayKey, type DayKey } from '../lib/dates';
  import { encodeShare, mergeWeek, resolvePlan, type Changes, type Dated, type Mode, type Slot, type Week } from '../lib/plan';

  let { week, changes }: { week: Week; changes: Changes } = $props();

  const ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  type DatedSlot = { date: string } & Slot;

  let oneOffs = $state<DatedSlot[]>([]);
  let important = $state<Dated[]>([]);
  let holidays = $state<{ from: string; to: string; label?: string }[]>([]);
  let newWeek = $state<Partial<Week> | undefined>();
  let o = $state<DatedSlot>({ date: '' });
  let imp = $state<Dated>({ date: '', label: '' });
  let h = $state({ from: '', to: '', label: '' });
  let wm = $state<Mode>('school');
  let grid = $state<Record<Mode, Record<DayKey, Slot>>>({
    school: Object.fromEntries(ORDER.map((k) => [k, { ...week.school[k] }])) as Record<DayKey, Slot>,
    holiday: Object.fromEntries(ORDER.map((k) => [k, { ...week.holiday[k] }])) as Record<DayKey, Slot>,
  });
  let msg = $state('');
  let origin = $state('');

  onMount(() => { origin = location.origin + location.pathname.replace(/plan\/?$/, ''); });

  const merged = $derived<Changes>({
    holidays: [...changes.holidays, ...holidays],
    oneOffs: [...changes.oneOffs, ...oneOffs],
    important: [...(changes.important ?? []), ...important],
  });
  const pretty = (d: string) => {
    const dt = new Date(`${d}T12:00:00`);
    return `${DAY_NAMES[dayKey(dt)]} ${dt.getDate()}/${dt.getMonth() + 1}`;
  };
  const preview = (d: string) => {
    const r = resolvePlan(new Date(`${d}T12:00:00`), week, merged, newWeek ? { week: newWeek } : {});
    return [r.headline, r.pickup && `pickup ${r.pickup}`, r.activity].filter(Boolean).join(' · ');
  };
  const clean = (s: Slot): Slot => {
    const out: Slot = {};
    for (const k of ['headline', 'pickup', 'activity'] as const) if (s[k]?.trim()) out[k] = s[k]!.trim().slice(0, 60);
    return out;
  };

  function addOne(e: SubmitEvent) {
    e.preventDefault();
    const c = clean(o);
    if (!o.date || !Object.keys(c).length) { msg = 'Pick a date and fill in at least one thing.'; return; }
    oneOffs = [...oneOffs.filter((x) => x.date !== o.date), { date: o.date, ...c }].sort((a, b) => a.date.localeCompare(b.date));
    o = { date: '' };
    msg = 'Added. Scroll down to "Your changes" to check it and copy the link.';
  }
  function addImportant(e: SubmitEvent) {
    e.preventDefault();
    if (!imp.date || !imp.label.trim()) { msg = 'Pick a date and say what it is.'; return; }
    important = [...important, { date: imp.date, label: imp.label.trim().slice(0, 40) }].sort((a, b) => a.date.localeCompare(b.date));
    imp = { date: '', label: '' };
    msg = 'Added. Scroll down to "Your changes" to check it and copy the link.';
  }
  function addHol(e: SubmitEvent) {
    e.preventDefault();
    if (!h.from || !h.to || h.to < h.from) { msg = 'Pick a start and an end date (end on or after start).'; return; }
    holidays = [...holidays, { from: h.from, to: h.to, ...(h.label.trim() ? { label: h.label.trim().slice(0, 40) } : {}) }];
    h = { from: '', to: '', label: '' };
    msg = 'Added. Scroll down to "Your changes" to check it and copy the link.';
  }
  function useWeek(e: SubmitEvent) {
    e.preventDefault();
    const part = (m: Mode) => Object.fromEntries(ORDER.map((k) => [k, clean(grid[m][k])]));
    newWeek = { school: part('school'), holiday: part('holiday') };
    msg = 'Usual week ready. Copy the link or the text below.';
  }

  const link = $derived(`${origin}today/#share=${encodeShare({ oneOffs, holidays, important, ...(newWeek ? { week: newWeek } : {}) })}`);
  const changesJson = $derived(JSON.stringify({ holidays: merged.holidays, oneOffs: merged.oneOffs, important: merged.important }, null, 2));
  const weekJson = $derived(newWeek ? JSON.stringify(mergeWeek(week, newWeek), null, 2) : '');
  const any = $derived(oneOffs.length + important.length + holidays.length > 0 || !!newWeek);

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); msg = `${what} copied.`; } catch { msg = 'Could not copy. Select the text and copy it by hand.'; }
  }
</script>

<h2 class="first">How to change the plan</h2>
<ol class="steps">
  <li><strong>Add a change.</strong> Most of the time you only need <em>Change one day</em>, below. For example, the dentist on Thursday instead of the usual club. It only affects that one date and disappears by itself afterwards.</li>
  <li><strong>Check it.</strong> Your changes appear in a list at the bottom of this page, showing what the Today page will say for that day.</li>
  <li><strong>Send it to the child's device.</strong> Press <em>Copy link for the child's device</em> and send that link to the phone or tablet in a message. Open it once on that device, and the change is saved there.</li>
</ol>

<details class="card help">
  <summary>Which box do I use? (with an example)</summary>
  <ul>
    <li><strong>Change one day</strong>: an appointment, a trip, or a different pickup time. Fill in only what is different. Anything you leave empty stays as usual.</li>
    <li><strong>Important date</strong>: something to look forward to, like a party. It shows with a star in the week ahead and does not change pickup or after-school.</li>
    <li><strong>Holiday dates</strong>: between these two dates, the Today page switches to the Holiday plan on its own. Add each school holiday once.</li>
    <li><strong>Change the usual week</strong>: for a lasting change, like a new club on Tuesdays. It changes every week, not just one day.</li>
  </ul>
  <p><strong>Example.</strong> The dentist is on Thursday the 26th, after school. Pick that date in <em>Change one day</em>, type <em>Dentist</em> under After school, and type the new pickup time if it changes. Press <em>Add this change</em>, then scroll to the bottom and press <em>Copy link for the child's device</em>.</p>
  <p><strong>To change it for everyone, for good</strong> (for example new school holiday dates): press <em>Copy text for changes.json</em>, open <a href="https://github.com/nao-mei/LFAQ/blob/main/content/changes.json">the changes file on GitHub</a>, click the pencil to edit, select everything, paste, and press <em>Commit changes</em>. The site updates within a couple of minutes. The site is public, so keep wording generic.</p>
</details>

<form class="card grid" onsubmit={addOne}>
  <h2>Change one day</h2>
  <p class="hint">Only for that day. Fill in just what is different, such as "Dentist" instead of swimming.</p>
  <label>Date<input type="date" bind:value={o.date} /></label>
  <label>School pickup<input type="text" bind:value={o.pickup} maxlength="60" placeholder="e.g. 2:15" /></label>
  <label>After school<input type="text" bind:value={o.activity} maxlength="60" placeholder="e.g. Dentist" /></label>
  <label>What's happening (optional)<input type="text" bind:value={o.headline} maxlength="60" /></label>
  <button class="btn blue small" type="submit">Add this change</button>
</form>

<form class="card grid" onsubmit={addImportant}>
  <h2>Important date</h2>
  <p class="hint">Shows with a star in the week ahead, such as a party or a trip.</p>
  <label>Date<input type="date" bind:value={imp.date} /></label>
  <label>What is it?<input type="text" bind:value={imp.label} maxlength="40" placeholder="e.g. Party" /></label>
  <button class="btn blue small" type="submit">Add important date</button>
</form>

<form class="card grid" onsubmit={addHol}>
  <h2>Holiday dates</h2>
  <p class="hint">Inside these dates the Today page switches to Holiday plans on its own.</p>
  <label>First day<input type="date" bind:value={h.from} /></label>
  <label>Last day<input type="date" bind:value={h.to} /></label>
  <label>Name (optional)<input type="text" bind:value={h.label} maxlength="40" placeholder="e.g. Half term" /></label>
  <button class="btn blue small" type="submit">Add holiday</button>
</form>

<details class="card usual">
  <summary>Change the usual week</summary>
  <form class="grid" onsubmit={useWeek}>
    <p class="hint">This changes the normal plan for every week, not just one day. Leave a box empty to show nothing for it.</p>
    <div class="seg" role="group" aria-label="Which kind of week">
      <button type="button" class:on={wm === 'school'} aria-pressed={wm === 'school'} onclick={() => (wm = 'school')}>School</button>
      <button type="button" class:on={wm === 'holiday'} aria-pressed={wm === 'holiday'} onclick={() => (wm = 'holiday')}>Holiday</button>
    </div>
    {#each ORDER as k}
      <fieldset>
        <legend>{DAY_NAMES[k]}</legend>
        <label>What's happening<input type="text" bind:value={grid[wm][k].headline} maxlength="60" /></label>
        <label>Pickup<input type="text" bind:value={grid[wm][k].pickup} maxlength="60" /></label>
        <label>After school<input type="text" bind:value={grid[wm][k].activity} maxlength="60" /></label>
      </fieldset>
    {/each}
    <button class="btn blue small" type="submit">Use as the usual week</button>
  </form>
</details>

{#if msg}<p role="status" class="msg">{msg}</p>{/if}

{#if any}
  <h2>Your changes</h2>
  <ul>
    {#each oneOffs as c}<li><strong>{pretty(c.date)}</strong>: {preview(c.date)}</li>{/each}
    {#each important as c}<li><strong>{pretty(c.date)}</strong>: ★ {c.label}</li>{/each}
    {#each holidays as c}<li><strong>{c.label ?? 'Holiday'}</strong>: {c.from} to {c.to}</li>{/each}
    {#if newWeek}<li><strong>New usual week</strong> (School and Holiday)</li>{/if}
  </ul>
  <div class="row">
    <button class="btn small" type="button" onclick={() => copy(link, 'Link')}>Copy link for the child's device</button>
    <button class="btn ghost small" type="button" onclick={() => copy(changesJson, 'Changes text')}>Copy text for changes.json</button>
    {#if newWeek}<button class="btn ghost small" type="button" onclick={() => copy(weekJson, 'Week text')}>Copy text for week.json</button>{/if}
    <button class="btn ghost small" type="button" onclick={() => { oneOffs = []; important = []; holidays = []; newWeek = undefined; }}>Clear</button>
  </div>
  <ul class="explain">
    <li><strong>Copy link for the child's device</strong>: send it to the phone or tablet and open it there once. These changes are then saved on that device only. One-off changes and important dates clear themselves after the day; a new usual week stays until it is changed again.</li>
    <li><strong>Copy text for changes.json / week.json</strong>: for changes everyone should see on every device. Paste it into the file on GitHub (the steps are under "Which box do I use?" at the top).</li>
    <li><strong>Clear</strong>: empties this list so you can start again. It does not undo anything already sent or saved.</li>
  </ul>
{/if}

<style>
  h2.first { margin-top: 0.4rem; }
  .steps { padding-left: 1.3rem; display: grid; gap: 0.5rem; margin: 0.4rem 0 1rem; }
  .help { margin: 1rem 0; }
  .help summary { font-weight: 800; font-size: 1.1rem; cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--blue-dark); }
  .help ul, .explain { padding-left: 1.2rem; display: grid; gap: 0.5rem; }
  .explain { color: var(--muted); font-size: 0.95rem; }
  .grid { display: grid; gap: 0.7rem; margin: 1rem 0; }
  .card.grid h2 { margin: 0; }
  .grid label { display: grid; gap: 0.25rem; }
  .hint { color: var(--muted); font-size: 0.9rem; margin: 0; }
  .msg { font-weight: 700; color: var(--red-dark); }
  .usual summary { font-weight: 800; font-size: 1.15rem; cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--blue-dark); }
  fieldset { border: 2px solid var(--line); border-radius: 14px; display: grid; gap: 0.5rem; padding: 0.6rem 0.8rem; margin: 0; }
  legend { font-weight: 800; padding: 0 0.4rem; color: var(--red-dark); }
  .seg { display: inline-flex; border: 3px solid var(--blue); border-radius: 999px; overflow: hidden; width: fit-content; }
  .seg button { font: inherit; font-weight: 800; border: 0; background: #fff; color: var(--blue-dark); padding: 0.55rem 1.2rem; min-height: 44px; cursor: pointer; }
  .seg button.on { background: var(--blue); color: #fff; }
</style>
