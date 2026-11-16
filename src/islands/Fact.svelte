<script lang="ts">
  import { onMount } from 'svelte';
  import { dayNumber } from '../lib/dates';

  type Fact = { text: string; topic: string };
  let { facts }: { facts: Fact[] } = $props();

  let offset = $state(0);
  let ready = $state(false);
  let base = $state(0);

  onMount(() => {
    // Same fact all day for everyone: the day number picks the position, and the list carries on round without a jump at New Year.
    base = dayNumber(new Date());
    ready = true;
  });
  const fact = $derived(facts[(base + offset) % facts.length]);
</script>

<div class="card factcard" aria-live="polite">
  {#if ready && fact}
    <p class="topic">{offset === 0 ? "Today's fact" : 'Another one'} · {fact.topic}</p>
    <p class="text">{fact.text}</p>
  {:else}
    <p class="text">Loading today's fact…</p>
  {/if}
</div>
<button class="btn" type="button" onclick={() => (offset += 1)} disabled={!ready}>Tell me another</button>
{#if offset > 0}<button class="btn ghost small" type="button" onclick={() => (offset = 0)}>Back to today's</button>{/if}

<style>
  .factcard { margin: 1rem 0; border-color: var(--blue); padding: 1.4rem; }
  .topic { margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem; color: var(--red); }
  .text { font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 800; color: var(--blue-dark); line-height: 1.25; margin: 0.5rem 0 0; }
</style>
