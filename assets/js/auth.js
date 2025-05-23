import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

   signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      window.location.href = 'dashboard.html';
    })
    .catch(err => alert('Login fallito: ' + err.message));
});
