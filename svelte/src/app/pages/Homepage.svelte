<script>
  import { onMount } from 'svelte';
  import FoodComponent from '../component/FoodComponent.svelte';
  import FormComponent from '../component/FormComponent.svelte';
  import LoginComponent from '../component/LoginComponent.svelte';
  import RouterLink from '../component/RouterLink.svelte';
  import { admin } from '../stores/stores.js';
  import { foodListe } from '../stores/stores.js';

  let neu = true;
  let text = "Account exists"
  let food = {};

  function btnHandler(){
  neu = !neu;

  if (neu){
    text = "Login in existing Account"
  }else{
    text = "Create new Account"
  }
  }

//let loggedIn = false;
let loggedIn = localStorage.current_user != null;
$: loggedIn = localStorage.current_user != null;
$: loggedIn && adminReset();

function adminReset(){
  if (!loggedIn){
    admin.set(False);
    console.log(loggedIn)
  }
}

function switchUrl(){
  if (loggedIn){
  const url= "http://localhost:8082/#/questions";
  window.location = url;

  }
}

function einloggen(){
  loggedIn = true;
  if (JSON.parse(localStorage.current_user).user_id == 1){
    setAdmin();
  }
}

function ausloggen(){
  console.log("logged out");
  loggedIn = false;
  localStorage.clear();
  reset();
}

function reset(){

  window.location.reload();

}


function setAdmin() {

	admin.set(true);

}


let maxIndex =  foodListe.length;
let index = 0;

let foodRating = {

  rating: null,
  food: null,
  user: null
};

const saveRelation = (e) => {

  foodRating.user = JSON.parse(localStorage.current_user);
  foodRating.food = food;
  foodRating.rating = e.detail;
  save(); 
  nextFood(); 

}

const save = () =>{
    axios.post("/food_ratings/" + foodRating.user.user_id + "/" + foodRating.food.food_id + "/" + foodRating.rating)
        .then((response) => {
        console.log(response.data);
        })
        .catch((error) => {
            console.log(error);
        })
}

let food_nr = foodListe[index];

const nextFood = () =>{
  if (index < maxIndex){
    index = index+1;
    food_nr = foodListe[index];
  }
      
}

</script>

<h1>Home sweet Home</h1>

{#if !loggedIn}
  {#if neu}
  <FormComponent on:logIn={einloggen}/>

  {:else}

  <LoginComponent  on:logIn={einloggen}/>

  {/if}

  <button type="button" on:click={btnHandler} class="btn btn-secondary mb-3" >{text}</button>

{:else}
  <button type="button" on:click={ausloggen} class="btn btn-secondary mb-3" >Ausloggen</button>

  <FoodComponent food_nr={food_nr} on:save-vote={saveRelation} onChange={newFood => food = newFood} />

{/if}