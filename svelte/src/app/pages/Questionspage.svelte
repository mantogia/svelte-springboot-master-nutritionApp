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
            console.log(newList[rating == 0])

            const schowiedereineliste = []

        })
        .catch((error) => {
            console.log(error);
        })
    
        
    
    

</script>

<h1>Ratings </h1>

<table class="table">
    <thead>
      <tr>
        <th scope="col">#</th>
        <th scope="col">Name</th>
        <th scope="col">Category</th>
        <th scope="col">Rating</th>
      </tr>
    </thead>
    <tbody>
      {#each newList as foodRating}
        <tr>
            <th scope="row">{foodRating.id}</th>
            <td>{foodRating.food.food_name}</td> 
            <td>{foodRating.food.category}</td> 
            <td>{foodRating.rating}</td> 
        </tr>
     {/each}
    </tbody>
  </table>

