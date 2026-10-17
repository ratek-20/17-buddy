<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { RatedPack } from '../../model/draft';
  import {
    ARENA_REFERENCE_VIEWPORT,
    fitArenaViewport,
    getBadgePosition,
    isPointOverCard,
    positionCards,
  } from '../arena-card-layout';
  import CardGradeBadge from './CardGradeBadge.svelte';

  export let pack: RatedPack | null;

  const BADGE_REVEAL_DELAY_MS = 100;

  let pointerIsOverCard = false;
  let badgesAreHidden = false;
  let badgeRevealTimer: ReturnType<typeof setTimeout> | null = null;
  let viewportWidth = ARENA_REFERENCE_VIEWPORT.width;
  let viewportHeight = ARENA_REFERENCE_VIEWPORT.height;

  $: positionedCards = pack ? positionCards(pack.cards) : [];
  $: viewport = fitArenaViewport(viewportWidth, viewportHeight);

  function handleMouseMove(event: MouseEvent): void {
    const isOverCard = positionedCards.some((positionedCard) =>
      isPointOverCard(positionedCard, event.clientX, event.clientY, viewport),
    );

    updateCardHover(isOverCard);
  }

  function updateCardHover(isOverCard: boolean): void {
    if (isOverCard === pointerIsOverCard) {
      return;
    }

    pointerIsOverCard = isOverCard;
    clearBadgeRevealTimer();

    if (isOverCard) {
      badgesAreHidden = true;
      return;
    }

    badgeRevealTimer = setTimeout(() => {
      badgesAreHidden = false;
      badgeRevealTimer = null;
    }, BADGE_REVEAL_DELAY_MS);
  }

  function clearBadgeRevealTimer(): void {
    if (badgeRevealTimer !== null) {
      clearTimeout(badgeRevealTimer);
      badgeRevealTimer = null;
    }
  }

  onDestroy(clearBadgeRevealTimer);
</script>

<svelte:window
  bind:innerHeight={viewportHeight}
  bind:innerWidth={viewportWidth}
  onmousemove={handleMouseMove}
  onmouseleave={() => updateCardHover(false)}
/>

{#if pack}
  <section
    class:hidden={badgesAreHidden}
    class="overlay"
    aria-label={`${pack.setCode} pack ${pack.packNumber}, pick ${pack.pickNumber} ratings`}
    aria-live="polite"
    style:--arena-scale={viewport.scale}
  >
    {#each positionedCards as positionedCard (positionedCard.card.id)}
      <div
        class="badge-position"
        style:left={`${getBadgePosition(positionedCard, viewport).left}px`}
        style:top={`${getBadgePosition(positionedCard, viewport).top}px`}
      >
        <CardGradeBadge card={positionedCard.card} />
      </div>
    {/each}
  </section>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  .overlay.hidden {
    opacity: 0;
  }

  .badge-position {
    position: absolute;
  }
</style>
