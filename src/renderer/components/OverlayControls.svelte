<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { RatedCard } from '../../model/draft';
  import type { SideboardCounts } from '../arena-deck-layout';
  import DeckSelector from './DeckSelector.svelte';
  import DeckStateEditor from './DeckStateEditor.svelte';

  const INTERACTION_PADDING = 32;

  export let options: string[];
  export let selected: string;
  export let pickedCards: RatedCard[];
  export let sideboardCounts: SideboardCounts;
  export let onSelectDeck: (deck: string) => void;
  export let onMoveCard: (
    cardId: number,
    destination: 'main' | 'sideboard',
  ) => void;

  let openPanel: 'deck' | 'state' | null = null;
  let interactionIsEnabled = false;
  let controlsElement: HTMLDivElement | undefined;

  function handleMouseMove(event: MouseEvent): void {
    if (!controlsElement) {
      return;
    }

    const bounds = controlsElement.getBoundingClientRect();
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
      openPanel = null;
    }
  }

  function selectDeck(deck: string): void {
    onSelectDeck(deck);
    openPanel = null;
  }

  onDestroy(() => {
    if (interactionIsEnabled) {
      window.draftOverlay.setInteractive(false);
    }
  });
</script>

<svelte:window onmousemove={handleMouseMove} />

<div bind:this={controlsElement} class="controls">
  {#if options.length > 0}
    <DeckSelector
      {options}
      {selected}
      isOpen={openPanel === 'deck'}
      onToggle={() => (openPanel = openPanel === 'deck' ? null : 'deck')}
      onSelect={selectDeck}
    />
  {/if}
  <DeckStateEditor
    cards={pickedCards}
    {sideboardCounts}
    isOpen={openPanel === 'state'}
    onToggle={() => (openPanel = openPanel === 'state' ? null : 'state')}
    onMove={onMoveCard}
  />
</div>

<style>
  .controls {
    position: fixed;
    top: 12%;
    left: 1rem;
    z-index: 20;
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    pointer-events: auto;
  }
</style>
