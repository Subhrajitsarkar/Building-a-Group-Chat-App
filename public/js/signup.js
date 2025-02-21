// public/js/signup.js

async function signup(event) {
    try {
        event.preventDefault();
        let name = event.target.name.value;
        let email = event.target.email.value;
        let number = event.target.number.value;
        let password = event.target.password.value;

        let obj = { name, email, number, password };

        let response = await axios.post('http://localhost:3000/user/signup', obj);

        if (response.status === 201) {
            alert(response.data.message || 'Signup successful');
            window.location.href = '/login';
        }
        document.getElementById('signupId').reset();
    } catch (err) {
        if (err.response && err.response.status === 409)
            alert('User already exists, Please log in');
        else
            document.body.innerHTML += `<div>${err.message}</div>`;
    }
}
