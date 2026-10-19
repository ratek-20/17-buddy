<script lang="ts">
  import { onDestroy } from 'svelte';

  const ALL_DECKS = 'ALL';
  const INTERACTION_PADDING = 32;

  export let options: string[];
  export let selected: string;
  export let onSelect: (deck: string) => void;

  let isOpen = false;
  let interactionIsEnabled = false;
  let selectorElement: HTMLDivElement | undefined;

  function handleMouseMove(event: MouseEvent): void {
    if (!selectorElement) {
      return;
    }

    const bounds = selectorElement.getBoundingClientRect();
    const shouldEnableInteraction =
      event.clientX >= bounds.left - INTERACTION_PADDING &&
      event.clientX <= bounds.right + INTERACTION_PADDING &&
      event.clientY >= bounds.top - INTERACTION_PADDING &&
      event.clientY <= bounds.bottom + INTERACTION_PADDING;

    if (shouldEnableInteraction === interactionIsEnabled) {
      return;
    }

    interactionIsEnabled = shouldEnableInteraction;
    window.draftOverlay.setInteractive(shouldEnableInteraction);
    if (!shouldEnableInteraction) {
      isOpen = false;
    }
  }

  function select(deck: string): void {
    onSelect(deck);
    isOpen = false;
  }

  onDestroy(() => {
    if (interactionIsEnabled) {
      window.draftOverlay.setInteractive(false);
    }
  });
</script>

<svelte:window onmousemove={handleMouseMove} />

<div bind:this={selectorElement} class="deck-selector">
  <button
    type="button"
    class="selector-button"
    aria-controls="deck-options"
    aria-expanded={isOpen}
    aria-haspopup="listbox"
    onclick={() => (isOpen = !isOpen)}
  >
    <span class="label">Deck</span>
    <strong>{selected === ALL_DECKS ? 'All' : selected}</strong>
    <span class:open={isOpen} class="arrow" aria-hidden="true">▾</span>
  </button>

  {#if isOpen}
    <div id="deck-options" class="options" role="listbox" aria-label="Deck colors">
      {#each [ALL_DECKS, ...options] as deck}
        <button
          type="button"
          class:selected={selected === deck}
          role="option"
          aria-selected={selected === deck}
          onclick={() => select(deck)}
        >
          {deck === ALL_DECKS ? 'All' : deck}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .deck-selector {
    position: fixed;
    top: 12%;
    left: 1rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    pointer-events: auto;
  }

  button {
    border: 1px solid rgb(255 255 255 / 45%);
    color: white;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .selector-button {
    display: flex;
    min-width: 7.5rem;
    align-items: center;
    gap: 0.55rem;
    padding: 0.45rem 0.6rem;
    border-radius: 0.5rem;
    background: rgb(15 18 22 / 88%);
    box-shadow: 0 0.2rem 0.6rem rgb(0 0 0 / 55%);
  }

  .label {
    color: rgb(255 255 255 / 70%);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .arrow {
    margin-left: auto;
    transition: transform 100ms ease;
  }

  .arrow.open {
    transform: rotate(180deg);
  }

  .options {
    display: flex;
    width: 7.5rem;
    max-height: 70vh;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.4rem;
    overflow-y: auto;
    border: 1px solid rgb(255 255 255 / 35%);
    border-radius: 0.5rem;
    background: rgb(15 18 22 / 94%);
    box-shadow: 0 0.3rem 0.8rem rgb(0 0 0 / 60%);
  }

  .options button {
    flex: 0 0 auto;
    width: 100%;
    min-height: 2rem;
    padding: 0.25rem;
    border-radius: 0.35rem;
    background: rgb(255 255 255 / 8%);
    font-size: 0.75rem;
  }

  .options button:hover,
  .options button.selected {
    border-color: #f2d06b;
    background: #f2d06b;
    color: #101318;
  }
</style>
