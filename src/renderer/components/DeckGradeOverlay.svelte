<script lang="ts">
  import type { RatedCard } from '../../model/draft';
  import { ARENA_REFERENCE_VIEWPORT, fitArenaViewport } from '../arena-card-layout';
  import {
    positionMainDeckCards,
    type SideboardCounts,
  } from '../arena-deck-layout';
  import CardGradeBadge from './CardGradeBadge.svelte';

  export let cards: RatedCard[];
  export let sideboardCounts: SideboardCounts;

  let viewportWidth = ARENA_REFERENCE_VIEWPORT.width;
  let viewportHeight = ARENA_REFERENCE_VIEWPORT.height;

  $: viewport = fitArenaViewport(viewportWidth, viewportHeight);
  $: rows = positionMainDeckCards(cards, sideboardCounts, viewport);
</script>

<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />

<section
  class="deck-grades"
  aria-label="Picked card ratings"
  style:--arena-scale={viewport.scale}
>
  {#each rows as row (row.card.id)}
    <div class="badge-position" style:left={`${row.left}px`} style:top={`${row.top}px`}>
      <CardGradeBadge card={row.card} deckRow />
    </div>
  {/each}
</section>

<style>
  .deck-grades {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  .badge-position {
    position: absolute;
  }
</style>
