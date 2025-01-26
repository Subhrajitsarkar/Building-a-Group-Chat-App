async function login(event) {
    try {
        event.preventDefault()
        let email = event.target.email.value;
        let password = event.target.password.value;

        let obj = { email, password }

        let response = await axios.post('http://localhost:3000/user/login', obj)

        // if (response.status === 200)
        //     alert(`Welcome to chat 😎}`)
    }
    catch (err) {
        document.body.innerHTML += `<div>${err.message}</div>`
    }
}