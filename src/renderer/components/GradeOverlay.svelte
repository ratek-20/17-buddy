<script lang="ts">
  import type { RatedPack } from '../../model/draft';
  import CardGradeBadge from './CardGradeBadge.svelte';

  export let pack: RatedPack | null;
</script>

{#if pack}
  <section class="overlay" aria-live="polite">
    <header>
      <strong>{pack.setCode}</strong>
      <span>Pack {pack.packNumber} · Pick {pack.pickNumber}</span>
    </header>

    <div class="ratings">
      {#each pack.cards as card}
        <CardGradeBadge {card} />
      {/each}
    </div>
  </section>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 1rem;
    right: 1rem;
    width: min(30rem, calc(100vw - 2rem));
    padding: 0.75rem;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 0.9rem;
    background: rgb(5 8 12 / 78%);
    box-shadow: 0 0.6rem 2rem rgb(0 0 0 / 42%);
    backdrop-filter: blur(0.45rem);
  }

  header {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin-bottom: 0.6rem;
    padding-inline: 0.2rem;
    text-shadow: 0 1px 2px black;
  }

  header strong {
    font-size: 1rem;
  }

  header span {
    color: #cbd5e1;
    font-size: 0.8rem;
  }

  .ratings {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
  }
</style>
