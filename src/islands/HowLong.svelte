<script lang="ts">
  import { onMount } from 'svelte';
  import { daysTo, daysUntilChristmas, isoDate } from '../lib/dates';

  // Christmas is always the starting point. A chosen date is kept in this browser only, never in the site's files.
  const KEY = 'lfaq:howlong';
  type Target = { label: string; date: string };
  let now = $state(new Date());
  let custom = $state<Target | null>(null);
  let label = $state('');
  let date = $state('');
  let ready = $state(false);
  let snow = $state(false);

  const days = $derived(custom ? daysTo(now, custom.date) : daysUntilChristmas(now));
  const name = $derived(custom?.label ?? 'Christmas');
  const unit = $derived(days === 1 ? 'sleep' : 'sleeps');

  onMount(() => {
    try {
      const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Target | null;
      // A date that has gone by quietly falls back to Christmas.
      if (t && typeof t.label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.date >= isoDate(new Date())) custom = t;
    } catch { custom = null; }
    snow = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ready = true;
    const t = window.setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(t);
  });
  $effect(() => {
    const v = JSON.stringify(custom);
    if (!ready) return;
    try { custom ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* storage may be blocked */ }
  });

  function set(e: SubmitEvent) {
    e.preventDefault();
    if (!date || date < isoDate(now)) return;
    custom = { label: label.trim().slice(0, 30) || 'the big day', date };
    label = '';
    date = '';
  }
</script>

<h2 class="q">How long till {name}?</h2>
<div class="big" aria-live="polite">
  {#if snow && !custom}<div class="snow" aria-hidden="true">{#each Array(24) as _, i}<i style:left={`${(i * 41) % 100}%`} style:animation-delay={`${-(i * 0.9) % 9}s`} style:animation-duration={`${7 + (i % 5)}s`}></i>{/each}</div>{/if}
  {#if days === 0}
    <p class="num small">It's {custom ? 'today' : 'Christmas Day'}!</p>
  {:else}
    <p class="num">{days}</p>
    <p class="unit">{unit}</p>
  {/if}
</div>

<form class="card set" onsubmit={set}>
  <h2>Count down to something else</h2>
  <label>How long till…<input type="text" bind:value={label} maxlength="30" placeholder="e.g. the trip" autocomplete="off" /></label>
  <label>Date<input type="date" bind:value={date} min={isoDate(now)} required /></label>
  <div class="row">
    <button class="btn blue small" type="submit">Count down</button>
    {#if custom}<button class="btn ghost small" type="button" onclick={() => (custom = null)}>Back to Christmas</button>{/if}
  </div>
  <p class="note">Your date is only remembered on this device and browser.</p>
</form>

<style>
  .q { margin-top: 0.4rem; font-size: clamp(1.4rem, 5vw, 1.9rem); }
  .big { position: relative; overflow: hidden; border-radius: var(--radius); background: var(--blue-dark); color: #fff; text-align: center; padding: 2rem 1rem; }
  .num { font-size: clamp(5rem, 28vw, 9rem); font-weight: 900; line-height: 1; margin: 0; position: relative; }
  .num.small { font-size: clamp(2rem, 9vw, 3.4rem); }
  .unit { font-size: 1.5rem; font-weight: 800; margin: 0.3rem 0 0; position: relative; }
  .snow i { position: absolute; top: -10px; width: 8px; height: 8px; border-radius: 50%; background: #fff; opacity: 0.8; animation-name: fall; animation-iteration-count: infinite; animation-timing-function: linear; }
  @keyframes fall { to { transform: translateY(340px) translateX(24px); opacity: 0.2; } }
  .set { display: grid; gap: 0.7rem; margin-top: 1.4rem; }
  .set h2 { margin: 0; }
  .set label { display: grid; gap: 0.25rem; }
  .note { color: var(--muted); font-size: 0.9rem; margin: 0; }
</style>
