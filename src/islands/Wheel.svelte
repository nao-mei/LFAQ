<script lang="ts">
  import { onMount } from 'svelte';
  import { landingRotation, pickIndex, secureRandom, segmentSizes } from '../lib/wheel';

  type Item = { label: string; weight?: number };
  let {
    items,
    onresult,
    buttonLabel = 'Spin!',
    label = 'Wheel',
    autofocus = false,
  }: { items: Item[]; onresult?: (index: number) => void; buttonLabel?: string; label?: string; autofocus?: boolean } = $props();

  const DURATION = 4600;
  let rotation = $state(0);
  let spinning = $state(false);
  let reduce = $state(false);
  let btn = $state<HTMLButtonElement>();
  let timer = 0;

  const sizes = $derived(segmentSizes(items.map((i) => i.weight ?? 1)));
  const n = $derived(items.length);

  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [100 + r * Math.sin(a), 100 - r * Math.cos(a)] as const;
  };

  const segs = $derived.by(() => {
    let acc = 0;
    const longest = Math.max(1, ...items.map((i) => Math.min(i.label.length, 18)));
    return sizes.map((size, i) => {
      const start = acc;
      acc += size;
      const mid = start + size / 2;
      const [x1, y1] = pt(start, 96);
      const [x2, y2] = pt(acc, 96);
      const d = `M100 100 L${x1.toFixed(2)} ${y1.toFixed(2)} A96 96 0 ${size > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      const arcWidth = (2 * Math.PI * 60 * size) / 360;
      const fs = Math.max(4.5, Math.min(12, 66 / (longest * 0.58), arcWidth * 0.62));
      const fill = i % 2 === 0 ? 'var(--red)' : 'var(--blue)';
      const odd = n % 2 === 1 && n > 1 && i === n - 1;
      const text = items[i]!.label.length > 18 ? items[i]!.label.slice(0, 17) + '…' : items[i]!.label;
      return { d, mid, fs, fill: odd ? 'var(--tint)' : fill, text };
    });
  });

  onMount(() => {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (autofocus) btn?.focus();
    return () => clearTimeout(timer);
  });

  function spin() {
    if (spinning || n < 2) return;
    const idx = pickIndex(items.map((i) => i.weight ?? 1), secureRandom);
    const jitter = secureRandom() * 2 - 1;
    rotation = landingRotation(sizes, idx, rotation, reduce ? 0 : 5, jitter);
    spinning = true;
    timer = window.setTimeout(() => {
      spinning = false;
      onresult?.(idx);
    }, reduce ? 0 : DURATION + 100);
  }
</script>

<div class="wheelwrap">
  <div class="stage">
    <svg viewBox="0 0 200 200" role="img" aria-label={`${label}: ${items.map((i) => i.label).join(', ')}`}>
      <g
        class="disc"
        style:transform={`rotate(${rotation}deg)`}
        style:transition={reduce ? 'none' : `transform ${DURATION}ms cubic-bezier(0.12, 0.62, 0.12, 1)`}
      >
        {#if n === 1}
          <circle cx="100" cy="100" r="96" fill="var(--red)" />
        {:else}
          {#each segs as s}
            <path d={s.d} fill={s.fill} stroke="#fff" stroke-width="1.6" />
          {/each}
        {/if}
        {#each segs as s}
          <text
            transform={`rotate(${s.mid - 90} 100 100)`}
            x="186"
            y="100"
            dy="0.35em"
            text-anchor="end"
            font-size={s.fs}
            font-weight="800"
            fill="#fff">{s.text}</text>
        {/each}
      </g>
      <circle cx="100" cy="100" r="9" fill="#fff" stroke="var(--ink)" stroke-width="2.5" />
      <path d="M100 -8 L90 -12 L100 8 L110 -12 Z" fill="var(--ink)" stroke="#fff" stroke-width="2" stroke-linejoin="round" transform="translate(0 2)" />
    </svg>
  </div>
  <button class="btn" type="button" bind:this={btn} onclick={spin} disabled={spinning || n < 2}>
    {spinning ? 'Spinning…' : n < 2 ? 'Add more choices' : buttonLabel}
  </button>
</div>

<style>
  .wheelwrap { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
  .stage { width: min(84vw, 420px); margin-top: 1.4rem; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .disc { transform-origin: 100px 100px; transform-box: view-box; will-change: transform; }
</style>
