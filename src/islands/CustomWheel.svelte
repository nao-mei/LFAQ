<script lang="ts">
  import { onMount } from 'svelte';
  import Wheel from './Wheel.svelte';
  import { fromB64, toB64 } from '../lib/b64';

  let { defaults = [] }: { defaults?: string[] } = $props();

  const KEY = 'lfaq:choices';
  const MAX = 12;
  let options = $state<string[]>([]);
  let text = $state('');
  let winner = $state<string>();
  let removeWinner = $state(false);
  let notice = $state('');
  let ready = $state(false);

  const enc = (a: string[]) => toB64(JSON.stringify(a));
  const dec = (s: string): string[] | null => {
    try {
      const a = JSON.parse(fromB64(s));
      return Array.isArray(a) ? a.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, MAX) : null;
    } catch { return null; }
  };

  onMount(() => {
    const m = location.hash.match(/^#o=(.+)$/);
    const shared = m ? dec(m[1]!) : null;
    if (shared?.length) options = shared;
    else {
      // First visit (nothing saved yet) starts with the default choices; after that, whatever was left on the wheel is kept.
      try {
        const saved = localStorage.getItem(KEY);
        options = saved === null ? [...defaults] : JSON.parse(saved);
      } catch { options = [...defaults]; }
    }
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(options)); } catch { /* storage may be blocked */ }
  });

  function add(e: SubmitEvent) {
    e.preventDefault();
    const t = text.trim().slice(0, 40);
    if (!t || options.length >= MAX) return;
    options = [...options, t];
    text = '';
    winner = undefined;
  }
  const remove = (i: number) => { options = options.filter((_, j) => j !== i); winner = undefined; };
  function onresult(i: number) {
    winner = options[i];
    if (removeWinner) options = options.filter((_, j) => j !== i);
  }
  async function share() {
    const url = `${location.origin}${location.pathname}#o=${enc(options)}`;
    try { await navigator.clipboard.writeText(url); notice = 'Link copied!'; } catch { notice = url; }
  }
</script>

<form class="row add" onsubmit={add}>
  <label class="sr" for="opt">New choice</label>
  <input id="opt" type="text" bind:value={text} maxlength="40" placeholder="Type a choice" autocomplete="off" disabled={options.length >= MAX} />
  <button class="btn blue small" type="submit" disabled={options.length >= MAX}>Add</button>
</form>
{#if options.length >= MAX}<p>That's the most you can fit on the wheel ({MAX}).</p>{/if}

{#if options.length}
  <ul class="chips">
    {#each options as o, i}
      <li>{o} <button type="button" class="x" onclick={() => remove(i)} aria-label={`Remove ${o}`}>×</button></li>
    {/each}
  </ul>
{:else}
  <p>Add at least two choices to get a wheel.</p>
{/if}

{#if options.length >= 2}
  <Wheel items={options.map((label) => ({ label }))} label="Your choices" {onresult} />
{/if}

<div class="live" aria-live="polite">
  {#if winner}<div class="result"><small>The wheel says</small>{winner}</div>{/if}
</div>

<div class="row opts">
  <label><input type="checkbox" bind:checked={removeWinner} /> Take the winner off the wheel after each spin</label>
  {#if options.length}
    <button class="btn ghost small" type="button" onclick={share}>Copy a link to this wheel</button>
    <button class="btn ghost small" type="button" onclick={() => { options = []; winner = undefined; }}>Clear all</button>
  {/if}
  {#if defaults.length}
    <button class="btn ghost small" type="button" onclick={() => { options = [...defaults]; winner = undefined; }}>Back to {defaults.join(', ')}</button>
  {/if}
</div>
{#if notice}<p class="notice" role="status">{notice}</p>{/if}

<style>
  .add { margin: 0.5rem 0 1rem; }
  .add input { flex: 1 1 220px; }
  .chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; margin: 0 0 0.5rem; }
  .chips li { background: #fff; border: 2px solid var(--blue); border-radius: 999px; padding: 0.2rem 0.3rem 0.2rem 0.9rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem; }
  .x { border: 0; background: var(--red); color: #fff; width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; line-height: 1; cursor: pointer; }
  .live { min-height: 1rem; }
  .opts { margin-top: 1rem; justify-content: center; }
  .notice { word-break: break-all; text-align: center; }
</style>
