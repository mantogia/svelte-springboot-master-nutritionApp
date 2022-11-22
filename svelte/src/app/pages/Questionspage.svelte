<script>
    import FoodComponent from "../component/FoodComponent.svelte";

    let user_id = 1;


    let food = {
        food_id: 1,
        food_name: "pizza",
        category: "gerichte"
    }

    let foodRating = {
        rating: 0,
        food_id: 0,
        user_id: 0

    }

    const saveRelation = (e) => {
        
       
        const newVote = e.detail;
        axios.get("/users/" + user_id)

            .then((response) => {
            console.log(response.data);

            if(response.data.user_id = user_id){
            foodRating.user_id = response.data.user_id;
            foodRating.food_id = food.food_id;
            foodRating.rating = newVote;

            console.log(foodRating);
            save();
            }
            })
            .catch((error) => {
                        console.log(error)
            })
    }

    const save = () =>{
        axios.post("/food_ratings", foodRating)
            .then((response) => {
            console.log(response.data);
            })
            .catch((error) => {
                console.log(error);
            })
    }


</script>

<h1> Questions </h1>

<FoodComponent food_objekt={food} on:save-vote={saveRelation}> </FoodComponent>