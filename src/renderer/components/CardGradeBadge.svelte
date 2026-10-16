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
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border: 2px solid rgb(255 255 255 / 70%);
    border-radius: 0.55rem;
    box-shadow: 0 0.25rem 0.7rem rgb(0 0 0 / 55%);
    color: #101318;
    font-size: 1.1rem;
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
</style>
