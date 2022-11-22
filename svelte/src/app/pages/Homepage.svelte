<script>
  import FoodComponent from '../component/FoodComponent.svelte';
  import FormComponent from '../component/FormComponent.svelte';
  import LoginComponent from '../component/LoginComponent.svelte';

  import { admin } from '../stores/stores.js';


  let neu = true;

  let text = "Account exists"

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

let food = {
        food_id: 1,
        food_name: "pizza",
        category: "gerichte"
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
}

function setAdmin() {
	admin.set(true);
  console.log("test");

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

  <FoodComponent food_objekt ={food}/>

{/if}