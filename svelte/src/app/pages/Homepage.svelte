<script>
  import FormComponent from '../component/FormComponent.svelte';
  import LoginComponent from '../component/LoginComponent.svelte';


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

</script>

<h1>Home sweet Home</h1>


{#if neu}
<FormComponent />

{:else}

<LoginComponent />

{/if}

<button type="button" on:click={btnHandler} class="btn btn-secondary mb-3" >{text}</button>


