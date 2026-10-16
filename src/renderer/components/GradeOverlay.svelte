<script lang="ts">
  import type { RatedPack } from '../../model/draft';
  import { positionCards } from '../arena-card-layout';
  import CardGradeBadge from './CardGradeBadge.svelte';

  export let pack: RatedPack | null;

  const FIRST_BADGE_LEFT_VW = 18.25;
  const FIRST_BADGE_TOP_VH = 20.95;
  const COLUMN_STEP_VW = 11.4;
  const ROW_STEP_VH = 24.08;

  $: positionedCards = pack ? positionCards(pack.cards) : [];
</script>

{#if pack}
  <section
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

  .badge-position {
    position: absolute;
  }
</style>
