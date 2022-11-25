<script>
    import FoodComponent from "../component/FoodComponent.svelte";

    let user_id = 1;
    let user = {}
    let food = {}
    let foodRating = {}

    let newList = [];

    axios.get("/users/" + user_id + "/food_ratings")
        .then((response) => {
            console.log(response.data);
            newList = response.data;
        })
        .catch((error) => {
            console.log(error);
        })
    

</script>

<h1> Questions </h1>

{#each newList as foodRating}
   <div>{foodRating.id}</div> 
   <div>{foodRating.food.food_name}</div> 
   <div>{foodRating.food.category}</div> 
   <div>{foodRating.rating}</div> 
{/each}