<script>
    import FoodComponent from "../component/FoodComponent.svelte";

    let user_id = 1;

    let user = {

        user_id: 0,
        user_name: "",
        user_email: "",
        user_password: "",
        food_ratings: []

    }


    let food = {
        food_id: 1,
        food_name: "pizza",
        category: "gerichte"
    }

    let foodRating = {
        rating: 0,
        food: 0,
        user: 0

    }

    const saveRelation = (e) => {
        
       
        const newVote = e.detail;
        axios.get("/users/" + user_id)

            .then((response) => {
            console.log(response.data);
            user = response.data;
            if(user.user_id = user_id){

            foodRating.user = user;
            foodRating.food = food;
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
        axios.post("/food_ratings/"+ foodRating.user.user_id+"/"+foodRating.food.food_id+"/"+foodRating.rating)
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