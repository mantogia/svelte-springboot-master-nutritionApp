<script>   

export let user;

export let evaluation;



</script>

<div class="card border-dark mb-3 r" style="max-width: 18rem;" >
    <h5 class="card-header">Kategorie: {evaluation[0]}</h5>
    <div class="card-body">
      <h5 class="card-title">Anzahl Ratings in dieser Kategorie: {evaluation[2]}</h5>
      <p class="card-text">Summe aller Ratings in dieser Kategorie: {evaluation[1]}</p>
      <p class="card-text">Durchschnittliches Rating in dieser Kategorie: {evaluation[3]}</p>
      <p class="card-text">Anzahl dislikes: {evaluation[4]}</p>
      <p class="card-text">Anzahl likes: {evaluation[5]}</p>
      <p class="card-text">Anzahl superlikes: {evaluation[6]}</p>
    </div>
  </div>

<style>

</style>
