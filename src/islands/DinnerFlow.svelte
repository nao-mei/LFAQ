<script lang="ts">
  import Wheel from './Wheel.svelte';

  type Node = { label: string; weight?: number; children?: Node[] };
  let { tree }: { tree: Node } = $props();

  let first = $state<Node>();
  let final = $state<string>();
  let pickMode = $state(false);
  let round = $state(0);

  const options = $derived(first?.children ?? []);

  function onFirst(i: number) {
    const node = tree.children![i]!;
    first = node;
    // A single follow-up needs no spin; it is the answer.
    if (node.children?.length === 1) final = node.children[0]!.label;
    else if (!node.children?.length) final = node.label;
  }
  function onSecond(i: number) {
    final = options[i]!.label;
  }
  function again() {
    first = undefined;
    final = undefined;
    pickMode = false;
    round++;
  }
</script>

<div class="flow">
  {#key round}
    {#if !first}
      <Wheel items={tree.children!} label="What kind of dinner" onresult={onFirst} buttonLabel="Spin for dinner!" />
    {:else if !final}
      <p class="step" aria-live="polite">It landed on <strong>{first.label}</strong>. Now choose!</p>
      {#if pickMode}
        <div class="picks">
          {#each options as o, i}
            <button class="btn blue" type="button" onclick={() => onSecond(i)}>{o.label}</button>
          {/each}
        </div>
        <button class="btn ghost small" type="button" onclick={() => (pickMode = false)}>Spin it instead</button>
      {:else}
        <Wheel items={options} label={`${first.label} choices`} onresult={onSecond} buttonLabel="Spin again!" />
        <button class="btn ghost small" type="button" onclick={() => (pickMode = true)}>I'll just pick</button>
      {/if}
    {/if}
  {/key}

  <div aria-live="polite" class="live">
    {#if final}
      <div class="result">
        <small>{first && first.label !== final ? first.label : 'Dinner is'}</small>
        {final}
      </div>
      <button class="btn small" type="button" onclick={again}>Start again</button>
    {/if}
  </div>
</div>

<style>
  .flow { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
  .step { font-size: 1.2rem; margin: 0; }
  .picks { display: flex; flex-wrap: wrap; gap: 0.7rem; justify-content: center; }
  .live { display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%; }
</style>
