<script>
    import FoodComponent from "../component/FoodComponent.svelte";

    let user_id = 1;


    let food = {
        food_name: "pizza",
        category: "gerichte"
    }

</script>

<h1> Questions </h1>

<FoodComponent food_objekt={food}> </FoodComponent>