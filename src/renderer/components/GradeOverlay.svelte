<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { RatedPack } from '../../model/draft';
  import { positionCards } from '../arena-card-layout';
  import CardGradeBadge from './CardGradeBadge.svelte';

  export let pack: RatedPack | null;

  const FIRST_CARD_LEFT_VW = 10.1;
  const FIRST_CARD_TOP_VH = 19.05;
  const CARD_WIDTH_VW = 10.7;
  const CARD_HEIGHT_VH = 23.4;
  const FIRST_BADGE_LEFT_VW = 18.25;
  const FIRST_BADGE_TOP_VH = 20.95;
  const COLUMN_STEP_VW = 11.4;
  const ROW_STEP_VH = 24.08;
  const BADGE_REVEAL_DELAY_MS = 100;

  let pointerIsOverCard = false;
  let badgesAreHidden = false;
  let badgeRevealTimer: ReturnType<typeof setTimeout> | null = null;

  $: positionedCards = pack ? positionCards(pack.cards) : [];

  function handleMouseMove(event: MouseEvent): void {
    const pointerX = (event.clientX / window.innerWidth) * 100;
    const pointerY = (event.clientY / window.innerHeight) * 100;
    const isOverCard = positionedCards.some(({ column, row }) => {
      const cardLeft = FIRST_CARD_LEFT_VW + column * COLUMN_STEP_VW;
      const cardTop = FIRST_CARD_TOP_VH + row * ROW_STEP_VH;

      return (
        pointerX >= cardLeft &&
        pointerX <= cardLeft + CARD_WIDTH_VW &&
        pointerY >= cardTop &&
        pointerY <= cardTop + CARD_HEIGHT_VH
      );
    });

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
  onmousemove={handleMouseMove}
  onmouseleave={() => updateCardHover(false)}
/>

{#if pack}
  <section
    class:hidden={badgesAreHidden}
    class="overlay"
    aria-label={`${pack.setCode} pack ${pack.packNumber}, pick ${pack.pickNumber} ratings`}
    aria-live="polite"
  >
    {#each positionedCards as positionedCard (positionedCard.card.id)}
      <div
        class="badge-position"
        style:left={`${FIRST_BADGE_LEFT_VW + positionedCard.column * COLUMN_STEP_VW}vw`}
        style:top={`${FIRST_BADGE_TOP_VH + positionedCard.row * ROW_STEP_VH}vh`}
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
