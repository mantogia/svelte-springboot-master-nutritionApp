<script>

    export let food_objekt;

    const handleVote = (vote) => {
        console.log(vote)
    }

</script>


<div class="card" style="width: 18rem;">
    <img src="./images/test.jpg" class="card-img-top" alt="hier kommt das Bild hin">
    <div class="card-body">
      <h5 class="card-title">Card title</h5>
        <p class="card-text">
            {food_objekt.food_name}
        </p>
      <button class="btn btn-primary" on:click={() => handleVote(0)}>dislike</button>
      <button class="btn btn-primary" on:click={() => handleVote(1)}>like</button>
      <button class="btn btn-primary" on:click={() => handleVote(2)}>superlike</button>
    </div>
</div>

<style>
    .card{
        color: black;
    }
</style>