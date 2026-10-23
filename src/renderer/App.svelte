<script lang="ts">
  import { onMount } from 'svelte';
  import type { RatedPack } from '../model/draft';
  import {
    reconcileSideboardCounts,
    type SideboardCounts,
  } from './arena-deck-layout';
  import DeckGradeOverlay from './components/DeckGradeOverlay.svelte';
  import GradeOverlay from './components/GradeOverlay.svelte';
  import OverlayControls from './components/OverlayControls.svelte';

  const ALL_DECKS = 'ALL';
  const DRAFT_STATE_STORAGE_KEY = '17-buddy.active-draft-state';

  type PersistedDraftState = {
    setCode: string;
    pickedCardIds: number[];
    sideboardCounts: SideboardCounts;
  };

  let pack: RatedPack | null = null;
  let selectedDeck = ALL_DECKS;
  let sideboardCounts: SideboardCounts = {};

  onMount(() =>
    window.draftOverlay.onPackRated((ratedPack) => {
      const startsNewDraft =
        ratedPack.packNumber === 1 && ratedPack.pickNumber === 1;

      if (pack === null) {
        sideboardCounts = startsNewDraft
          ? {}
          : restoreSideboardCounts(ratedPack);
      } else if (ratedPack.setCode !== pack.setCode || startsNewDraft) {
        sideboardCounts = {};
      }

      if (
        pack === null ||
        ratedPack.setCode !== pack.setCode ||
        startsNewDraft ||
        (selectedDeck !== ALL_DECKS &&
          !ratedPack.availableDecks.includes(selectedDeck))
      ) {
        selectedDeck = ALL_DECKS;
      }

      sideboardCounts = reconcileSideboardCounts(
        ratedPack.pickedCards,
        sideboardCounts,
      );
      pack = ratedPack;
      persistDraftState();
    }),
  );

  $: displayedPack = pack ? selectDeckRating(pack, selectedDeck) : null;

  function selectDeckRating(ratedPack: RatedPack, deck: string): RatedPack {
    if (deck === ALL_DECKS) {
      return ratedPack;
    }

    const selectRating = (card: RatedPack['cards'][number]) => ({
      ...card,
      ...(card.deckRatings?.[deck] ?? { gihwr: null, grade: null }),
    });

    return {
      ...ratedPack,
      cards: ratedPack.cards.map(selectRating),
      pickedCards: ratedPack.pickedCards.map(selectRating),
    };
  }

  function moveCard(
    cardId: number,
    destination: 'main' | 'sideboard',
  ): void {
    if (!pack) {
      return;
    }

    const total = pack.pickedCards.filter((card) => card.id === cardId).length;
    const current = sideboardCounts[cardId] ?? 0;
    const next = destination === 'sideboard' ? current + 1 : current - 1;

    sideboardCounts = reconcileSideboardCounts(pack.pickedCards, {
      ...sideboardCounts,
      [cardId]: Math.max(0, Math.min(next, total)),
    });
    persistDraftState();
  }

  function restoreSideboardCounts(ratedPack: RatedPack): SideboardCounts {
    try {
      const storedValue = localStorage.getItem(DRAFT_STATE_STORAGE_KEY);
      if (!storedValue) {
        return {};
      }

      const stored = JSON.parse(storedValue) as Partial<PersistedDraftState>;
      if (
        stored.setCode !== ratedPack.setCode ||
        !Array.isArray(stored.pickedCardIds) ||
        !stored.sideboardCounts ||
        !isPreviousPool(stored.pickedCardIds, ratedPack.pickedCards.map(({ id }) => id))
      ) {
        return {};
      }

      return reconcileSideboardCounts(ratedPack.pickedCards, stored.sideboardCounts);
    } catch {
      return {};
    }
  }

  function persistDraftState(): void {
    if (!pack) {
      return;
    }

    const state: PersistedDraftState = {
      setCode: pack.setCode,
      pickedCardIds: pack.pickedCards.map(({ id }) => id),
      sideboardCounts,
    };
    localStorage.setItem(DRAFT_STATE_STORAGE_KEY, JSON.stringify(state));
  }

  function isPreviousPool(previous: number[], current: number[]): boolean {
    const available = new Map<number, number>();
    for (const id of current) {
      available.set(id, (available.get(id) ?? 0) + 1);
    }

    for (const id of previous) {
      const count = available.get(id) ?? 0;
      if (count === 0) {
        return false;
      }
      available.set(id, count - 1);
    }

    return true;
  }
</script>

{#if pack}
  <OverlayControls
    options={pack.availableDecks}
    selected={selectedDeck}
    pickedCards={pack.pickedCards}
    {sideboardCounts}
    onSelectDeck={(deck) => (selectedDeck = deck)}
    onMoveCard={moveCard}
  />
{/if}

<GradeOverlay pack={displayedPack} />

{#if displayedPack}
  <DeckGradeOverlay cards={displayedPack.pickedCards} {sideboardCounts} />
{/if}
