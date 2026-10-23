<script lang="ts">
  import type { RatedCard } from '../../model/draft';

  export let card: RatedCard;

  $: gradeClass = `grade-${card.grade?.charAt(0).toLowerCase() ?? 'none'}`;
</script>

<span
  class="grade {gradeClass}"
  aria-label={`${card.name}: grade ${card.grade ?? 'unrated'}`}
>
  {card.grade ?? '—'}
</span>

<style>
  .grade {
    display: grid;
    width: clamp(1.25rem, calc(2.25rem * var(--arena-scale, 1)), 4.5rem);
    height: clamp(1.25rem, calc(2.25rem * var(--arena-scale, 1)), 4.5rem);
    place-items: center;
    border: 2px solid rgb(15 18 22 / 85%);
    border-radius: 0.45rem;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 65%),
      0 0.2rem 0.55rem rgb(0 0 0 / 70%);
    color: #101318;
    font-size: clamp(0.6rem, calc(0.95rem * var(--arena-scale, 1)), 1.9rem);
    font-weight: 900;
    line-height: 1;
  }

  .grade-a {
    background: #55c878;
  }

  .grade-b {
    background: #a8cf63;
  }

  .grade-c {
    background: #e9c95f;
  }

  .grade-d {
    background: #ed9a4d;
  }

  .grade-f {
    background: #e56b3f;
  }

  .grade-none {
    background: #9ca3af;
  }
</style>
