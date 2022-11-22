<script>

let user = {
    user_name: "",
    user_email: "",
    user_password: "",
    food_ratings: []
}


function saveUser(){

    console.log(user)

    axios.post('/users', user)
        .then((response) => {
            console.log(response.data);
        })
        .catch((error) => {
            console.log(error);
        })
    
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

let check_mail = false;

function checkEmailAdress(){
    let mail = user.user_email
    if(mail.length >= minLength && mail.search("@") != -1 && mail.search(".") != -1){
        console.log("mail okey")
        check_mail = true;
        check();
    } else{
        console.log("mail bad")
        check_mail = false;
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


let disabled = !(check_password && check_mail && check_username);

function check(){

    disabled = !(check_password && check_mail && check_username)
}


</script>

<h2>Registration Formular</h2>

<form class="row g-3">
<div class="mb-3">
    <label for="usernameInput" class="form-label">Username</label>
    <input on:change={checkUsername} bind:value={user.user_name} type="String" class="form-control" id="usernameInput" placeholder="your username">
</div>
<div class="mb-3">
    <label for="exampleFormControlInput1" class="form-label">Email address</label>
    <input on:change={checkEmailAdress} bind:value={user.user_email} type="email" class="form-control" id="exampleFormControlInput1" placeholder="name@example.com">
</div>
<div class="mb-3 row">
    <label for="inputPassword" class="col-sm-2 col-form-label">Password</label>
    <div class="col-sm-10">
      <input on:change={checkPassword} bind:value={user.user_password} type="password" class="form-control" id="inputPassword">
    </div>
  </div>
  <div class="col-auto">
    <button href="#/questions" disabled={disabled} type="button" on:click={saveUser} class="btn btn-primary mb-3" >Confirm identity</button>
  </div>
</form>