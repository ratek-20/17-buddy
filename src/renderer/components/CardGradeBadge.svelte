<script lang="ts">
  import type { RatedCard } from '../../model/draft';

  export let card: RatedCard;

  $: winRate =
    card.gihwr === null ? 'No data' : `${(card.gihwr * 100).toFixed(1)}%`;
  $: gradeClass = `grade-${card.grade?.charAt(0).toLowerCase() ?? 'none'}`;
</script>

<article class="card-rating">
  <span class="grade {gradeClass}">
    {card.grade ?? '—'}
  </span>
  <span class="details">
    <strong>{card.name}</strong>
    <span>GIHWR {winRate}</span>
  </span>
</article>

<style>
  .card-rating {
    display: grid;
    grid-template-columns: 2.6rem minmax(0, 1fr);
    gap: 0.55rem;
    align-items: center;
    min-width: 0;
    padding: 0.45rem;
    border: 1px solid rgb(255 255 255 / 22%);
    border-radius: 0.65rem;
    background: rgb(12 15 20 / 88%);
    box-shadow: 0 0.3rem 1rem rgb(0 0 0 / 38%);
  }

  .grade {
    display: grid;
    width: 2.6rem;
    height: 2.6rem;
    place-items: center;
    border-radius: 0.55rem;
    color: #101318;
    font-size: 1.05rem;
    font-weight: 900;
    line-height: 1;
  }

  .grade-a {
    background: #62d88d;
  }

  .grade-b {
    background: #72b7ff;
  }

  .grade-c {
    background: #f2d06b;
  }

  .grade-d {
    background: #f4a261;
  }

  .grade-f {
    background: #ef6b73;
  }

  .grade-none {
    background: #9ca3af;
  }

  .details {
    display: grid;
    min-width: 0;
    gap: 0.1rem;
    font-size: 0.72rem;
    color: #cbd5e1;
  }

  strong {
    overflow: hidden;
    color: white;
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
