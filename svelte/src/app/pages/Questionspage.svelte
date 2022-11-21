<script>
  import FoodComponent from "../component/FoodComponent.svelte";

    let user_id = 1;
    let start = 0;

    function beginQuestions(){
        

    }

    const saveRelation = (e) =>{
        let newVote = e.detail;

        axios.get("/users/", user_id )
            .then( (response) => {
                console.log(response.data);
        })
    }


    let food = {
        food_name: "pizza",
        category: "gerichte"
    }

</script>

<h1> Questions </h1>

<FoodComponent food_objekt={food} on:save-Vote{saveRelation}> </FoodComponent>