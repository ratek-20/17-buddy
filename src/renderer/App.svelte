<script lang="ts">
  import { onMount } from 'svelte';
  import type { RatedPack } from '../model/draft';
  import GradeOverlay from './components/GradeOverlay.svelte';

  let pack: RatedPack | null = null;

  onMount(() =>
    window.draftOverlay.onPackRated((ratedPack) => {
      pack = ratedPack;
    }),
  );
</script>

<GradeOverlay {pack} />
