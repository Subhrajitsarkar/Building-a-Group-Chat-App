async function signup(event) {
    event.preventDefault()
    let name = event.target.name.value;
    let email = event.target.email.value;
    let number = event.target.number.value;
    let password = event.target.password.value;

    let obj = { name, email, number, password }

    let response = await axios.post('http://localhost:3000/user/signup', obj)

    if (response.status === 201) {
        window.location.href = '/login'
    }
}
