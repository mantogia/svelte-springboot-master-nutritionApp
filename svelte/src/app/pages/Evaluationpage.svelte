<script>
  import EvaluationComponent from "../evaluation/EvaluationComponent.svelte";



    let user = JSON.parse(localStorage.current_user);
    let food = {}
    let foodRating = {}
    let newList = [];
    let category_list = []
    let listEvaluation = []
    let cat_liste = [];

   
        axios.get("/food_ratings/users/" + user.user_id + "/string")
        .then((response) => {
            console.log(response.data);
            listEvaluation = response.data;
            
        })
        .catch((error) => {
            console.log(error);
        })
    



    /*class Evaluation {

      constructor

      (category, anzahl_0, anzahl_1, anzahl_2, anzahl_total, summe, durchschnitt) 

      { 

        this.category = category;
        this.anzahl_0 = anzahl_0;
        this.anzahl_1 = anzahl_1;
        this.anzahl_2 = anzahl_2;
        this.anzahl_total = anzahl_total;
        this.summe = summe,
        this.durchschnitt = durchschnitt

      }
     
      }*/


   

    axios.get("/users/" + user.user_id + "/food_ratings")
        .then((response) => {
            console.log(response.data);
            newList = response.data;

            //const newEv = new Evaluation();
             //listEvaluation = [...listEvaluation, newEv];

         })
        .catch((error) => {
            console.log(error);
        })


    

</script>


<h1>Evaluation</h1>

{#each listEvaluation as evaluation}
<EvaluationComponent user={user} evaluation={evaluation}></EvaluationComponent>
{/each}

<h1>Ratings</h1>
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

