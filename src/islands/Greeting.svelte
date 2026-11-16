<script lang="ts">
  import { onMount } from 'svelte';

  // hi: what is shown. say: a plain-English way to read it out loud. code: language tag for the device's voice
  // (left out where devices rarely have a voice, so a wrong-sounding voice is never used).
  type G = { hi: string; lang: string; say: string; code?: string };
  // The English one is shown first (and when scripts are off); the rest are shuffled on every visit.
  // The name is whatever the child chose, kept only in this browser. Without one, it is "Buddy".
  const DEFAULT_NAME = 'Buddy';
  const NAME_KEY = 'lfaq:name';
  const OTHERS: G[] = [
    { hi: 'Hola', lang: 'Spanish', say: 'OH-la', code: 'es-ES' },
    { hi: 'Bonjour', lang: 'French', say: 'bon-ZHOOR', code: 'fr-FR' },
    { hi: 'Ciao', lang: 'Italian', say: 'chow', code: 'it-IT' },
    { hi: 'Hallo', lang: 'German', say: 'HAH-lo', code: 'de-DE' },
    { hi: 'Olá', lang: 'Portuguese', say: 'oh-LAH', code: 'pt-PT' },
    { hi: 'Hej', lang: 'Swedish', say: 'hay', code: 'sv-SE' },
    { hi: 'Hei', lang: 'Norwegian', say: 'hay', code: 'nb-NO' },
    { hi: 'Hoi', lang: 'Dutch', say: 'hoy', code: 'nl-NL' },
    { hi: 'こんにちは', lang: 'Japanese', say: 'kon-nee-chee-WAH', code: 'ja-JP' },
    { hi: '안녕', lang: 'Korean', say: 'ahn-nyeong', code: 'ko-KR' },
    { hi: '你好', lang: 'Mandarin (as spoken in Taiwan)', say: 'nee HOW', code: 'zh-TW' },
    { hi: '你好', lang: 'Cantonese', say: 'nay HOH', code: 'zh-HK' },
    { hi: 'Lí hó', lang: 'Taiwanese Hokkien', say: 'lee HOH' },
    { hi: 'नमस्ते', lang: 'Hindi', say: 'nuh-MUS-tay', code: 'hi-IN' },
    { hi: 'Merhaba', lang: 'Turkish', say: 'mehr-HAH-bah', code: 'tr-TR' },
    { hi: 'שלום', lang: 'Hebrew', say: 'shah-LOHM', code: 'he-IL' },
    { hi: 'Jambo', lang: 'Swahili', say: 'JAHM-boh', code: 'sw-KE' },
    { hi: 'Sawubona', lang: 'Zulu', say: 'sah-woo-BOH-nah' },
    { hi: 'Molo', lang: 'Xhosa (South Africa)', say: 'MOH-loh' },
    { hi: 'Sannu', lang: 'Hausa (West Africa)', say: 'SAHN-noo' },
    { hi: 'Báwo ni', lang: 'Yoruba (Nigeria)', say: 'BAH-woh nee' },
    { hi: 'Ndewo', lang: 'Igbo (Nigeria)', say: 'n-DEH-woh' },
    { hi: 'Akwaaba', lang: 'Twi (Ghana), it means welcome', say: 'ah-KWAH-bah' },
    { hi: 'Mhoro', lang: 'Shona (Zimbabwe)', say: 'MOH-roh' },
    { hi: 'ሰላም', lang: 'Amharic (Ethiopia)', say: 'seh-LAHM' },
    { hi: 'مرحبا', lang: 'Arabic (Egypt and North Africa)', say: 'MAR-ha-ba', code: 'ar-EG' },
    { hi: 'Salama', lang: 'Malagasy (Madagascar)', say: 'sa-LAH-ma' },
    { hi: 'Aloha', lang: 'Hawaiian', say: 'ah-LOH-hah' },
    { hi: 'Kia ora', lang: 'Māori', say: 'KEE-ah OR-ah' },
    { hi: "G'day", lang: 'Australian English', say: 'guh-DAY', code: 'en-AU' },
    { hi: 'Szia', lang: 'Hungarian', say: 'SEE-ah', code: 'hu-HU' },
    { hi: 'Ahoj', lang: 'Czech', say: 'AH-hoy', code: 'cs-CZ' },
    { hi: 'Cześć', lang: 'Polish', say: 'cheshch', code: 'pl-PL' },
    { hi: 'Γειά σου', lang: 'Greek', say: 'YAH soo', code: 'el-GR' },
    { hi: 'Καλημέρα', lang: 'Greek (good morning)', say: 'kah-lee-MEH-rah', code: 'el-GR' },
    { hi: 'Γεια χαρά', lang: 'Greek (a friendly hello)', say: 'yah hah-RAH', code: 'el-GR' },
    { hi: 'Dia dhuit', lang: 'Irish', say: 'DEE-ah GWITCH', code: 'ga-IE' },
    { hi: 'Shwmae', lang: 'Welsh', say: 'SHOO-my', code: 'cy-GB' },
    { hi: 'Привет', lang: 'Russian', say: 'pree-VYET', code: 'ru-RU' },
    { hi: 'Xin chào', lang: 'Vietnamese', say: 'sin CHOW', code: 'vi-VN' },
    { hi: 'Halo', lang: 'Indonesian', say: 'HAH-lo', code: 'id-ID' },
    { hi: 'สวัสดี', lang: 'Thai', say: 'sa-wat-DEE', code: 'th-TH' },
    { hi: 'Salut', lang: 'Romanian', say: 'sah-LOOT', code: 'ro-RO' },
  ];

  let name = $state(DEFAULT_NAME);
  let other = $state<G | null>(null); // null = the "Hey <name>!" greeting
  let asking = $state(false);
  let draft = $state('');
  const first = $derived<G>({
    hi: `Hey ${name}!`,
    lang: 'English',
    say: name === DEFAULT_NAME ? 'hay BUD-ee' : '',
    code: 'en-GB',
  });
  const current = $derived(other ?? first);
  let tick = $state(0);
  let queue: G[] = [];
  let pausedUntil = 0;
  // Only voices stored on the device are used, so nothing is ever fetched from the internet to speak.
  let voices = $state.raw<SpeechSynthesisVoice[]>([]);

  const norm = (l: string) => l.toLowerCase().replace('_', '-');
  function voiceFor(code?: string) {
    if (!code) return undefined;
    const want = norm(code);
    return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).split('-')[0] === want.split('-')[0]);
  }
  const voice = $derived(voiceFor(current.code));

  // Every visit shuffles the list; it is used up before the same greeting can come round again.
  function another() {
    if (queue.length === 0) {
      queue = [...OTHERS];
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j]!, queue[i]!];
      }
    }
    other = queue.pop()!;
    tick++;
    pausedUntil = 0;
    window.speechSynthesis?.cancel();
  }

  function hear() {
    if (!voice) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(current.hi.replace(/!$/, ''));
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.8;
    synth.speak(u);
    pausedUntil = Date.now() + 12_000; // stay on this greeting while it is being listened to
  }

  function saveName(e: SubmitEvent) {
    e.preventDefault();
    // Plain letters, numbers and common punctuation only, short enough to fit on the screen.
    const clean = draft.replace(/[^\p{L}\p{N} '’.-]/gu, '').trim().slice(0, 20);
    setName(clean || DEFAULT_NAME);
  }
  function setName(n: string) {
    name = n;
    other = null;
    tick++;
    asking = false;
    pausedUntil = Date.now() + 6000; // let the new greeting be seen before the cycling starts again
    try { n === DEFAULT_NAME ? localStorage.removeItem(NAME_KEY) : localStorage.setItem(NAME_KEY, n); } catch { /* storage may be blocked */ }
  }
  function ask() {
    draft = name === DEFAULT_NAME ? '' : name;
    asking = true;
  }

  onMount(() => {
    try { name = localStorage.getItem(NAME_KEY)?.slice(0, 20) || DEFAULT_NAME; } catch { name = DEFAULT_NAME; }
    const synth = window.speechSynthesis;
    const load = () => { voices = synth.getVoices().filter((v) => v.localService); };
    if (synth) {
      load();
      synth.addEventListener('voiceschanged', load);
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Gentle auto-cycling, except for people who asked for less motion (they use the button instead).
    const t = reduce ? 0 : window.setInterval(() => { if (!document.hidden && !asking && Date.now() >= pausedUntil) another(); }, 3200);
    return () => {
      clearInterval(t);
      synth?.removeEventListener('voiceschanged', load);
      synth?.cancel();
    };
  });
</script>

<div class="greet">
  <h1><span class="sr">Hey {name}! Welcome.</span>
    <span class="hi" aria-hidden="true">{#key tick}<span class="word" class:blue={tick % 2 === 1}>{current.hi}</span>{/key}</span>
  </h1>
  <p class="lang">{current.lang}{#if current.say} · say it: <strong>{current.say}</strong>{/if}</p>
  <div class="row buttons">
    {#if voice}
      <button class="btn blue small" type="button" onclick={hear} aria-label={`Hear ${current.hi} in ${current.lang}`}>🔊 Hear it</button>
    {/if}
    <button class="btn ghost small" type="button" onclick={another}>Say hi in another language</button>
  </div>
  {#if asking}
    <form class="ask" onsubmit={saveName}>
      <label for="nm">What should I call you?</label>
      <div class="row buttons">
        <input id="nm" type="text" bind:value={draft} maxlength="20" placeholder={DEFAULT_NAME} autocomplete="off" />
        <button class="btn blue small" type="submit">That's me</button>
        <button class="btn ghost small" type="button" onclick={() => (asking = false)}>Cancel</button>
      </div>
      <p class="note">Only remembered in this browser. Leave it empty and I'll say {DEFAULT_NAME}.</p>
    </form>
  {:else}
    <p class="who">
      <button type="button" class="link" onclick={ask}>{name === DEFAULT_NAME ? `Not ${DEFAULT_NAME}? Tell me your name` : 'Call me something else'}</button>
      {#if name !== DEFAULT_NAME}<button type="button" class="link" onclick={() => setName(DEFAULT_NAME)}>Back to {DEFAULT_NAME}</button>{/if}
    </p>
  {/if}
</div>

<style>
  .greet { text-align: center; margin: 0.4rem 0 1rem; }
  h1 { margin: 0; min-height: 1.2em; }
  .hi { display: block; font-size: clamp(2.4rem, 11vw, 4.2rem); line-height: 1.15; font-weight: 900; }
  .word { display: inline-block; color: var(--red); }
  .word.blue { color: var(--blue); }
  .lang { margin: 0.1rem 0 0.7rem; min-height: 1.5rem; font-weight: 600; color: var(--muted); }
  .lang strong { color: var(--ink); }
  .buttons { justify-content: center; }
  .word { max-width: 100%; overflow-wrap: anywhere; }
  .who { margin: 0.4rem 0 0; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
  .link { font: inherit; font-size: 0.9rem; font-weight: 700; color: var(--blue-dark); background: none; border: 0; text-decoration: underline; cursor: pointer; min-height: 44px; padding: 0 0.3rem; }
  .ask { margin-top: 0.8rem; display: grid; gap: 0.5rem; justify-items: center; }
  .ask input { width: min(100%, 14rem); }
  .note { margin: 0; color: var(--muted); font-size: 0.85rem; }
  @media (prefers-reduced-motion: no-preference) {
    .word { animation: rise 0.45s ease-out; }
    @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: none; } }
  }
</style>
