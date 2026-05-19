// Importa e inizializza Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPZMMpsVIJUDb3FPDLeKRvHZ9uCefsAVM",
  authDomain: "duecentogrammi-2f6f1.firebaseapp.com",
  projectId: "duecentogrammi-2f6f1",
  storageBucket: "duecentogrammi-2f6f1.firebasestorage.app",
  messagingSenderId: "863127720030",
  appId: "1:863127720030:web:9876ad76a6019f4db7a4cf"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
