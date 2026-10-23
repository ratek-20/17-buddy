<script lang="ts">
  import type { RatedCard } from '../../model/draft';
  import {
    groupPickedCards,
    type SideboardCounts,
  } from '../arena-deck-layout';

  export let cards: RatedCard[];
  export let sideboardCounts: SideboardCounts;
  export let isOpen: boolean;
  export let onToggle: () => void;
  export let onMove: (cardId: number, destination: 'main' | 'sideboard') => void;

  $: groups = groupPickedCards(cards);
</script>

<div class="deck-state">
  <button
    type="button"
    class="state-button"
    aria-controls="deck-state-options"
    aria-expanded={isOpen}
    onclick={onToggle}
  >
    <span>My Picks</span>
    <strong>{cards.length}</strong>
    <span class:open={isOpen} class="arrow" aria-hidden="true">▾</span>
  </button>

  {#if isOpen}
    <div id="deck-state-options" class="editor" aria-label="Main deck and sideboard">
      <p>Move cards between your deck and sideboard.</p>
      {#if groups.length === 0}
        <p class="empty">Your picks will appear here.</p>
      {:else}
        <div class="card-list">
          {#each groups as group (group.card.id)}
            {@const sideboardCount = sideboardCounts[group.card.id] ?? 0}
            {@const mainDeckCount = group.count - sideboardCount}
            <div class="card-row">
              <span class="card-name" title={group.card.name}>
                {group.card.name}{group.count > 1 ? ` ×${group.count}` : ''}
              </span>
              <button
                type="button"
                class:active={mainDeckCount > 0}
                disabled={sideboardCount === 0}
                title="Move one copy to the main deck"
                onclick={() => onMove(group.card.id, 'main')}
              >
                MB {mainDeckCount}
              </button>
              <button
                type="button"
                class:active={sideboardCount > 0}
                disabled={mainDeckCount === 0}
                title="Move one copy to the sideboard"
                onclick={() => onMove(group.card.id, 'sideboard')}
              >
                SB {sideboardCount}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .deck-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }

  button {
    border: 1px solid rgb(255 255 255 / 45%);
    color: white;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .state-button {
    display: flex;
    min-width: 8.5rem;
    align-items: center;
    gap: 0.55rem;
    padding: 0.45rem 0.6rem;
    border-radius: 0.5rem;
    background: rgb(15 18 22 / 88%);
    box-shadow: 0 0.2rem 0.6rem rgb(0 0 0 / 55%);
  }

  .state-button strong {
    color: #f2d06b;
  }

  .arrow {
    margin-left: auto;
    transition: transform 100ms ease;
  }

  .arrow.open {
    transform: rotate(180deg);
  }

  .editor {
    width: min(24rem, 70vw);
    padding: 0.55rem;
    border: 1px solid rgb(255 255 255 / 35%);
    border-radius: 0.5rem;
    background: rgb(15 18 22 / 96%);
    box-shadow: 0 0.3rem 0.8rem rgb(0 0 0 / 60%);
    color: white;
  }

  p {
    margin: 0 0 0.45rem;
    color: rgb(255 255 255 / 70%);
    font-size: 0.7rem;
  }

  .empty {
    margin: 0;
  }

  .card-list {
    display: flex;
    max-height: 62vh;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
  }

  .card-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3.3rem 3.3rem;
    align-items: center;
    gap: 0.3rem;
  }

  .card-name {
    overflow: hidden;
    font-size: 0.75rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-row button {
    min-height: 1.8rem;
    padding: 0.2rem;
    border-radius: 0.35rem;
    background: rgb(255 255 255 / 8%);
    font-size: 0.68rem;
  }

  .card-row button.active {
    border-color: #f2d06b;
    color: #f2d06b;
  }
</style>
