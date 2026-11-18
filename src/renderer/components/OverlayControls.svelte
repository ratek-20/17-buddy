<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { RatedCard } from '../../model/draft';
  import type { SideboardCounts } from '../arena-deck-layout';
  import DeckSelector from './DeckSelector.svelte';
  import DeckStateEditor from './DeckStateEditor.svelte';

  const INTERACTION_PADDING = 32;

  let {
    options,
    selected,
    pickedCards,
    sideboardCounts,
    onSelectDeck,
    onMoveCard,
  }: {
    options: string[];
    selected: string;
    pickedCards: RatedCard[];
    sideboardCounts: SideboardCounts;
    onSelectDeck: (deck: string) => void;
    onMoveCard: (cardId: number, destination: 'main' | 'sideboard') => void;
  } = $props();

  let openPanel = $state<'deck' | 'state' | null>(null);
  let interactionIsEnabled = false;
  let controlsElement = $state<HTMLDivElement>();

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

  function resetInteraction(): void {
    openPanel = null;
    if (interactionIsEnabled) {
      interactionIsEnabled = false;
      window.draftOverlay.setInteractive(false);
    }
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      resetInteraction();
    }
  }

  onDestroy(resetInteraction);
</script>

<svelte:window onmousemove={handleMouseMove} onmouseleave={resetInteraction} />
<svelte:document onvisibilitychange={handleVisibilityChange} />

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
