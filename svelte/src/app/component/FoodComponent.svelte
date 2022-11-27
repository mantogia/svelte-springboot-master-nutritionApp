<script>

    import {onMount} from "svelte";
    import { createEventDispatcher} from "svelte";
    import { fly } from 'svelte/transition';

    const dispatch = createEventDispatcher();

    export let food_nr;
    $: food_nr && update();

    let food = {};
    export let onChange
    $: onChange(food)
    
    onMount(() => update());

    function update(){
        axios.get("/foods/" + food_nr)
        .then((response) => {
            //console.log(response.data);
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

</script>


<div class="card mx-auto mt-5" style="width: 18rem; text-align: center;">
    <img src="./images/{food_nr}.jpg" class="card-img-top" alt="Hier kommt das Bild hin">
    <div class="card-body">

      <button class="btn btn-primary" on:click={() => handleVote(0)} transition:fly="{{ x: 200, duration: 2000 }}">dislike</button>
      <button class="btn btn-primary" on:click={() => handleVote(1)}>like</button>
      <button class="btn btn-primary" on:click={() => handleVote(2)}>superlike</button>
    </div>
</div>

<style>
    .card{
        color: black;
    }
</style>