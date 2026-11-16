<script lang="ts">
  import { onMount } from 'svelte';

  type Pic = { src: string; alt: string };
  let { pictures }: { pictures: Pic[] } = $props();

  let host = $state<HTMLElement>();
  let canvas = $state<HTMLCanvasElement>();
  let phase = $state<'hidden' | 'finding' | 'done'>('hidden');
  let alt = $state('');
  let showAll = $state<() => void>(() => {});

  onMount(() => {
    if (!host || !canvas || pictures.length === 0) return;
    const el = host;
    const cv = canvas;
    const ctx = cv.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const RED: [number, number, number] = [196, 18, 47];
    const BLUE: [number, number, number] = [29, 78, 216];
    const BRUSH = 44; // how wide a swipe uncovers
    const FADE_IN = 220; // ms for a dot to come into view
    const REACH = 66; // how far a finger or cursor pushes dots
    const SPRING = 95;
    const DAMP = 8.5; // low enough that dots bounce back with a wobble
    const RIPPLE_SPEED = 0.42; // px per ms
    const ENOUGH = 0.55; // share of the picture found before the rest comes out by itself

    // t: when the dot starts to appear (ms clock). Infinity = still hidden.
    type Dot = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; dark: number; col: string; t: number; w: number };
    let dots: Dot[] = [];
    let cols = 0;
    let rows = 0;
    let W = 0;
    let H = 0;
    let S = 6;
    let pointer: { x: number; y: number } | null = null;
    let prev: { x: number; y: number } | null = null;
    let ripples: { x: number; y: number; t: number; amp: number }[] = [];
    let last = 0;
    let raf = 0;
    let img: HTMLImageElement | null = null;
    let totalW = 1;
    let foundW = 0;
    let finished = false;
    let idle = 0;

    // Pictures come from a shuffled "deck" kept in this browser: every picture is shown once before any comes round
    // again, and the first of a new shuffle is never the one just seen. Without storage it is a plain random pick.
    const shuffle = <T,>(a: T[]): T[] => {
      const b = [...a];
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [b[i], b[j]] = [b[j]!, b[i]!];
      }
      return b;
    };
    const known = new Set(pictures.map((p) => p.src));
    let pic: Pic = pictures[Math.floor(Math.random() * pictures.length)]!;
    try {
      let deck: string[] = (JSON.parse(localStorage.getItem('lfaq:deck') ?? '[]') as string[]).filter((s) => known.has(s));
      if (deck.length === 0) {
        const prevSrc = localStorage.getItem('lfaq:lastPic');
        deck = shuffle(pictures.map((p) => p.src));
        if (deck.length > 1 && deck[0] === prevSrc) deck.push(deck.shift()!);
      }
      const next = deck.shift()!;
      pic = pictures.find((p) => p.src === next) ?? pic;
      localStorage.setItem('lfaq:deck', JSON.stringify(deck));
      localStorage.setItem('lfaq:lastPic', pic.src);
    } catch { /* keep the random pick */ }
    alt = pic.alt;

    const mix = (k: number) => {
      const c = RED.map((r, i) => Math.round(r + (BLUE[i]! - r) * k));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    };

    function physics(h: number, now: number) {
      for (const d of dots) {
        let ax = -SPRING * (d.x - d.hx) - DAMP * d.vx;
        let ay = -SPRING * (d.y - d.hy) - DAMP * d.vy;
        if (pointer) {
          const px = d.hx - pointer.x;
          const py = d.hy - pointer.y;
          const dist = Math.hypot(px, py) || 1;
          if (dist < REACH) {
            const f = (1 - dist / REACH) ** 2 * 900;
            ax += (px / dist) * f;
            ay += (py / dist) * f;
          }
        }
        for (const r of ripples) {
          const rx = d.hx - r.x;
          const ry = d.hy - r.y;
          const dist = Math.hypot(rx, ry) || 1;
          const delta = Math.abs((now - r.t) * RIPPLE_SPEED - dist);
          if (delta < 34) {
            // A ring that swells outward, strongest at its middle, softer as it travels.
            const f = (1 - delta / 34) ** 1.5 * r.amp * Math.max(0.25, 1 - dist / 700);
            ax += (rx / dist) * f;
            ay += (ry / dist) * f;
          }
        }
        d.vx += ax * h;
        d.vy += ay * h;
        d.x += d.vx * h;
        d.y += d.vy * h;
      }
    }

    function frame(now: number): boolean {
      const dt = Math.min(0.5, Math.max(0.001, (now - (last || now - 16)) / 1000));
      last = now;
      ripples = ripples.filter((r) => (now - r.t) * RIPPLE_SPEED < Math.hypot(W, H) + 80);
      if (!reduce) {
        const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
        for (let i = 0; i < steps; i++) physics(dt / steps, now);
      }
      let energy = 0;
      let animating = false;
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        const disp = Math.hypot(d.x - d.hx, d.y - d.hy);
        energy += disp + Math.abs(d.vx) * 0.05 + Math.abs(d.vy) * 0.05;
        const k = d.t === Infinity ? 0 : Math.min(1, Math.max(0, (now - d.t) / FADE_IN));
        if (d.t !== Infinity && k < 1) animating = true;
        let r = (S / 2) * (0.2 + (0.34 + 0.66 * d.dark - 0.2) * k);
        let a = 0.2 + (0.45 + 0.55 * d.dark - 0.2) * k;
        const fill = k > 0.02 ? d.col : '#6f8fe0';
        // Dots that are being pushed swell and glow, so a ripple can be seen travelling.
        if (disp > 0.8) {
          r += Math.min(2.4, disp * 0.16);
          a = Math.min(1, a + Math.min(0.5, disp * 0.07));
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return animating || energy > 1.5 || ripples.length > 0 || !!pointer;
    }

    const loop = (now: number) => {
      raf = frame(now) ? requestAnimationFrame(loop) : 0;
      if (!raf) last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    function build() {
      if (!img) return;
      W = el.clientWidth;
      if (!W) return;
      S = W < 420 ? 5 : 6;
      H = Math.min(Math.round(W * 0.75), 420);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(W / S);
      rows = Math.floor(H / S);
      const off = document.createElement('canvas');
      off.width = cols;
      off.height = rows;
      const o = off.getContext('2d', { willReadFrequently: true })!;
      o.fillStyle = '#fff';
      o.fillRect(0, 0, cols, rows);
      // Fill the whole frame (crop the edges if needed) so the picture uses all of the dots.
      const sc = Math.max(cols / img.naturalWidth, rows / img.naturalHeight);
      const dw = img.naturalWidth * sc;
      const dh = img.naturalHeight * sc;
      o.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
      const px = o.getImageData(0, 0, cols, rows).data;
      // Stretch the tones so any picture, flat or photo, uses the full range from small to large dots.
      const lum: number[] = [];
      for (let i = 0; i < cols * rows; i++) lum.push((0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!) / 255);
      const sorted = [...lum].sort((a, b) => a - b);
      const lo = sorted[Math.floor(sorted.length * 0.02)]!;
      const hi = sorted[Math.floor(sorted.length * 0.98)]!;
      const span = Math.max(0.15, hi - lo);
      const ox = (W - cols * S) / 2;
      const keep = new Map<string, number>();
      for (const d of dots) keep.set(`${d.hx}|${d.hy}`, d.t); // so a resize does not hide what was found
      dots = [];
      totalW = 0;
      foundW = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dark = Math.min(1, Math.max(0, 1 - (lum[y * cols + x]! - lo) / span));
          const hx = ox + x * S + S / 2;
          const hy = y * S + S / 2;
          const t = keep.get(`${hx}|${hy}`) ?? Infinity;
          // Dark parts of the picture count for more when judging how much has been found.
          const w = 0.1 + dark;
          totalW += w;
          if (t !== Infinity) foundW += w;
          dots.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0, dark, col: mix(dark), t, w });
        }
      }
      frame(performance.now());
      last = 0;
    }

    function uncover(d: Dot, at: number) {
      if (d.t !== Infinity) return;
      d.t = at;
      foundW += d.w;
    }

    // Everything the pointer has passed over comes into view and stays. A fast swipe is filled in along the line.
    function paint(x0: number, y0: number, x1: number, y1: number, now: number) {
      const minC = Math.max(0, Math.floor((Math.min(x0, x1) - BRUSH * 1.6) / S));
      const maxC = Math.min(cols - 1, Math.ceil((Math.max(x0, x1) + BRUSH * 1.6) / S));
      const minR = Math.max(0, Math.floor((Math.min(y0, y1) - BRUSH * 1.6) / S));
      const maxR = Math.min(rows - 1, Math.ceil((Math.max(y0, y1) + BRUSH * 1.6) / S));
      const vx = x1 - x0;
      const vy = y1 - y0;
      const len2 = vx * vx + vy * vy || 1;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const d = dots[r * cols + c];
          if (!d || d.t !== Infinity) continue;
          const u = Math.max(0, Math.min(1, ((d.hx - x0) * vx + (d.hy - y0) * vy) / len2));
          const dist = Math.hypot(d.hx - (x0 + u * vx), d.hy - (y0 + u * vy));
          // Close dots appear straight away; those at the edge of the brush follow a moment later, like a soft halo.
          if (dist < BRUSH * 1.5) uncover(d, reduce ? now - 1e6 : now + Math.max(0, dist - BRUSH * 0.5) * 3);
        }
      }
    }

    function checkProgress(now: number, x: number, y: number) {
      if (phase === 'hidden') phase = 'finding';
      if (!finished && foundW / totalW >= ENOUGH) complete(now, x, y);
    }

    // Enough has been found: the rest spreads out from the last touch, with a ripple to celebrate.
    function complete(now: number, x: number, y: number) {
      finished = true;
      phase = 'done';
      for (const d of dots) uncover(d, reduce ? now - 1e6 : now + Math.hypot(d.hx - x, d.hy - y) * 1.6);
      if (!reduce) {
        ripples.push({ x, y, t: now, amp: 2000 });
        ripples.push({ x, y, t: now + 160, amp: 1000 });
      }
      kick();
    }
    showAll = () => complete(performance.now(), W / 2, H / 2);

    const local = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const now = performance.now();
      paint(prev?.x ?? p.x, prev?.y ?? p.y, p.x, p.y, now);
      prev = p;
      pointer = p;
      checkProgress(now, p.x, p.y);
      kick();
    };
    // A touch or click sends a ripple outward (a quick echo follows) and uncovers what is right underneath.
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      const now = performance.now();
      prev = p;
      pointer = p;
      paint(p.x, p.y, p.x, p.y, now);
      if (!reduce) {
        ripples.push({ x: p.x, y: p.y, t: now, amp: finished ? 1700 : 1100 });
        ripples.push({ x: p.x, y: p.y, t: now + 150, amp: finished ? 850 : 500 });
        navigator.vibrate?.(8);
      }
      checkProgress(now, p.x, p.y);
      kick();
    };
    const onLeave = () => { pointer = null; prev = null; kick(); };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('pointercancel', onLeave);

    const image = new Image();
    image.onload = () => { img = image; build(); };
    image.src = pic.src;

    const ro = new ResizeObserver(() => build());
    ro.observe(el);
    // Until someone touches it, a soft ripple now and then hints that the dots can be played with.
    if (!reduce) {
      idle = window.setInterval(() => {
        if (phase !== 'hidden' || document.hidden || !W) return;
        ripples.push({ x: W * (0.2 + Math.random() * 0.6), y: H * (0.25 + Math.random() * 0.5), t: performance.now(), amp: 1100 });
        kick();
      }, 4500);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(idle);
      ro.disconnect();
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('pointercancel', onLeave);
    };
  });
</script>

<div class="dots" bind:this={host}>
  <canvas bind:this={canvas} role="img" aria-label={alt ? `A picture made of dots: ${alt}` : 'A picture made of dots'}></canvas>
  <div class="foot">
    <p class="hint" aria-hidden="true">
      <span class="pulse"></span>{phase === 'hidden' ? 'Wipe across the dots' : phase === 'finding' ? 'Keep going… something is hiding' : 'Found it! Tap for ripples'}
    </p>
    {#if phase !== 'done'}
      <button class="show" type="button" onclick={() => showAll()}>Show me</button>
    {/if}
  </div>
</div>

<style>
  .dots { width: 100%; margin: 0 0 1rem; }
  canvas { display: block; width: 100%; touch-action: none; cursor: pointer; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.4rem; }
  .hint { display: flex; align-items: center; gap: 0.5rem; margin: 0; min-height: 1.4rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--red); }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--red); flex: none; }
  .show { font: inherit; font-size: 0.85rem; font-weight: 700; color: var(--blue-dark); background: none; border: 0; text-decoration: underline; cursor: pointer; min-height: 44px; padding: 0 0.5rem; }
  @media (prefers-reduced-motion: no-preference) {
    .pulse { animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.6); } }
  }
</style>
