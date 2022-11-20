<script>

axios.get('/patients')
    .then((response) => {
        console.log(response.data);
    })
    .catch((error) => {
        console.log(error)
    })

</script>

<h1>Wrong way, go back.</h1>