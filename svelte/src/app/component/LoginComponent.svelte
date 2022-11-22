<script>

    let user = {
        user_name: "",
        user_email: "",
        user_password: "",
        food_ratings: []
    }
    
    let minLength = 4;
    
    
    let check_username = false;
    
    function checkUsername(){
        if(user.user_name.length >= minLength){
            check_username = true;
            check();
        } else{
            check_username = false;
        }
    
    }
    
    
    let check_password = false;
    
    function checkPassword(){
        let password = user.user_password
    
        let test = hasNumbers(password);
        if(password.length >= minLength && test){
            console.log("password okey")
            check_password = true;
            check();
    
        } else{
            console.log("password bad")
            check_password = false;
        }
    
    }
    
    function hasNumbers(t)
        {
        var regex = /\d/g;
        return regex.test(t);
    }   
    
    
    let disabled = !(check_password && check_username);
    
    function check(){
    
        disabled = !(check_password && check_username)
    }
    
    
    function checkAccount(){

        axios.get("users/name/", user.user_name)
            .then

        
    }


    
    </script>
    
    <h2>Login Formular</h2>
    
    <form class="row g-3">
    <div class="mb-3">
        <label for="usernameInput" class="form-label">Username</label>
        <input on:change={checkUsername} bind:value={user.user_name} type="String" class="form-control" id="usernameInput" placeholder="your username">
    </div>
    <div class="mb-3 row">
        <label for="inputPassword" class="col-sm-2 col-form-label">Password</label>
        <div class="col-sm-10">
          <input on:change={checkPassword} bind:value={user.user_password} type="password" class="form-control" id="inputPassword">
        </div>
      </div>
      <div class="col-auto">
        <button disabled={disabled} type="button" on:click={checkAccount} class="btn btn-primary mb-3" >Confirm</button>
      </div>
    </form>