<script>

    import {onMount} from "svelte";

    export let food_nr;
    let food = {};

    

    import { createEventDispatcher} from "svelte";

    const dispatch = createEventDispatcher();

    onMount(() => update());

    function update(){
        axios.get("/foods/" + food_nr)
        .then((response) => {
            console.log(response.data);
            food = response.data;
        })
        .catch((error) => {
            console.log(error);
        })
    }


    const handleVote = (vote) => {
        console.log(vote)

        dispatch('save-vote', vote);

    }

    export let onChange
    $: onChange(food)

    $: food_nr && update();
</script>


<div class="card" style="width: 18rem;">
    <img src="./images/{food_nr}.jpg" class="card-img-top" alt="hier kommt das Bild hin">
    <div class="card-body">
        <p class="card-text">
            {food.food_name}
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