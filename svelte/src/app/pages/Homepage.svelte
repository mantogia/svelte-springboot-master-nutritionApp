<script>
  import { onMount } from 'svelte';
  import FoodComponent from '../component/FoodComponent.svelte';
  import FormComponent from '../component/FormComponent.svelte';
  import LoginComponent from '../component/LoginComponent.svelte';
  import RouterLink from '../component/RouterLink.svelte';
  import StartComponent from '../component/StartComponent.svelte';
  import { admin } from '../stores/stores.js';
  import { foodListe } from '../stores/stores.js';
  import {resetPage} from '../stores/stores.js';

  let neu = true;
  let text = "Bereits ein Konto?"
 

  function btnHandler(){
  neu = !neu;

  if (neu){
    text = "Bereits ein Konto?"
  }else{
    text = "Noch kein Konto?"
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
  resetPage();
}

function setAdmin() {

	admin.set(true);

}

</script>

<h1>FoodLike</h1>

{#if !loggedIn}
  {#if neu}
  <FormComponent on:logIn={einloggen}/>

  {:else}

  <LoginComponent  on:logIn={einloggen}/>

  {/if}

  <button type="button" on:click={btnHandler} class="btn btn-secondary mb-3" >{text}</button>

{:else}
  <button type="button" on:click={ausloggen} class="btn btn-secondary mb-3" >Abmelden</button>

  <StartComponent/>

{/if}