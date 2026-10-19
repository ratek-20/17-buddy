<script lang="ts">
  import { onMount } from 'svelte';
  import type { RatedPack } from '../model/draft';
  import DeckSelector from './components/DeckSelector.svelte';
  import GradeOverlay from './components/GradeOverlay.svelte';

  const ALL_DECKS = 'ALL';

  let pack: RatedPack | null = null;
  let selectedDeck = ALL_DECKS;

  onMount(() =>
    window.draftOverlay.onPackRated((ratedPack) => {
      if (
        pack === null ||
        ratedPack.setCode !== pack.setCode ||
        (ratedPack.packNumber === 1 && ratedPack.pickNumber === 1)
      ) {
        selectedDeck = ALL_DECKS;
      } else if (
        selectedDeck !== ALL_DECKS &&
        !ratedPack.availableDecks.includes(selectedDeck)
      ) {
        selectedDeck = ALL_DECKS;
      }

      pack = ratedPack;
    }),
  );

  $: displayedPack = pack ? selectDeckRating(pack, selectedDeck) : null;

  function selectDeckRating(ratedPack: RatedPack, deck: string): RatedPack {
    if (deck === ALL_DECKS) {
      return ratedPack;
    }

    return {
      ...ratedPack,
      cards: ratedPack.cards.map((card) => ({
        ...card,
        ...(card.deckRatings?.[deck] ?? { gihwr: null, grade: null }),
      })),
    };
  }
</script>

{#if pack && pack.availableDecks.length > 0}
  <DeckSelector
    options={pack.availableDecks}
    selected={selectedDeck}
    onSelect={(deck) => (selectedDeck = deck)}
  />
{/if}

<GradeOverlay pack={displayedPack} />
