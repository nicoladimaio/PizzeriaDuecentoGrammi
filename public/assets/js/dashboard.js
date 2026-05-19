import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { addDoc, collection, getDocs, deleteDoc,updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

const CATEGORIE = [
  "Antipasti",
  "Pizze classiche",
  "Pizze Speciali",
  "Bibite",
  "Birre alla spina",
  "Birre artigianali",
  "Vini bianchi",
  "Vini rossi",
  "Bollicine",
  "Caffè",
  "Amari",
  "Liquori",
  "Grappa",
  "Whisky & Rum"
];

const selectCat = document.getElementById('categoria');
CATEGORIE.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  selectCat.appendChild(opt);
});

const editSelectCat = document.getElementById('edit_categoria');
CATEGORIE.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  editSelectCat.appendChild(opt);
});

// Protegge l'accesso alla dashboard
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html?unauth=1';
  } else {
    document.getElementById('dashboardContent').style.display = '';
    caricaPizze();
  }
});

let editingId = null;

document.getElementById('addPizzaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nome').value;
  const ingredienti = document.getElementById('ingredienti').value;
  const prezzo = document.getElementById('prezzo').value;
  const categoria = document.getElementById('categoria').value;
  const immagineFile = document.getElementById('immagine').files[0];

  let immagineURL = '';
  if (immagineFile) {
    const categoriaSanificata = categoria.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const storageRef = ref(storage, categoriaSanificata + '/' + immagineFile.name);
    await uploadBytes(storageRef, immagineFile);
    immagineURL = await getDownloadURL(storageRef);
  }

  await addDoc(collection(db, 'pizze'), {
    nome,
    ingredienti,
    prezzo,
    categoria,
    immagine: immagineURL
  });

  // Imposta la categoria attiva su quella appena aggiunta
  categoriaFiltro = categoria;
  renderCategorieMenu();
  caricaPizze();

  // Chiudi la modale
  document.getElementById('addModal').style.display = 'none';
  e.target.reset();
});

window.pizzeData = [];
async function caricaPizze() {
  const listaDiv = document.getElementById('listaPizze');
  listaDiv.innerHTML = '';
  const querySnapshot = await getDocs(collection(db, 'pizze'));
  window.pizzeData = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    window.pizzeData.push({ ...data, id: docSnap.id });
    // Filtra per categoria se necessario
    if (categoriaFiltro !== "Tutte" && data.categoria !== categoriaFiltro) return;

    // Card stile menu.html
    let prezzo = (data.prezzo || '').toString().trim();
    if (!prezzo.includes('€')) prezzo = prezzo + ' €';

    const div = document.createElement('div');
div.className = "menu-card";
div.innerHTML = `
  ${data.immagine ? `<img src="${data.immagine}" class="menu-img" alt="${data.nome}">` : ''}
  <div class="menu-card-content">
    <div class="menu-card-title">${data.nome}</div>
    ${data.ingredienti ? `<div class="menu-card-desc">${data.ingredienti}</div>` : ''}
    <div class="menu-card-prezzo">${prezzo}</div>
  </div>
  <div class="pizza-actions">
    <button onclick="modificaPizza('${docSnap.id}', '${escapeQuotes(data.nome)}', '${escapeQuotes(data.ingredienti)}', '${escapeQuotes(data.prezzo)}', '${escapeQuotes(data.categoria || '')}')">Modifica</button>
    <button onclick="eliminaPizza('${docSnap.id}')">Elimina</button>
  </div>
`;
listaDiv.appendChild(div);
  });
}

// Funzione di escape per evitare problemi con le virgolette nei valori
function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.modificaPizza = function(id, nome, ingredienti, prezzo, categoria) {
  editingId = id;
  document.getElementById('edit_nome').value = nome;
  document.getElementById('edit_ingredienti').value = ingredienti;
  document.getElementById('edit_prezzo').value = prezzo;
  document.getElementById('edit_categoria').value = categoria;

  // Mostra anteprima immagine se esiste
  const pizza = window.pizzeData?.find(p => p.id === id);
  const imgPreview = document.getElementById('edit-img-preview');
  const removeBtn = document.getElementById('removeImageBtn');
  imgPreview.innerHTML = '';
  removeBtn.style.display = 'none';
  if (pizza && pizza.immagine) {
    imgPreview.innerHTML = `<img src="${pizza.immagine}" alt="Anteprima">`;
    removeBtn.style.display = '';
    removeBtn.onclick = function() {
      imgPreview.innerHTML = '';
      removeBtn.style.display = 'none';
      pizza.immagine = ''; // segna per rimozione
    };
  }
  document.getElementById('edit_immagine').value = '';
  document.getElementById('editModal').style.display = 'flex';
};

document.getElementById('closeEditModal').onclick = function() {
  document.getElementById('editModal').style.display = 'none';
  editingId = null;
};

window.eliminaPizza = async function (id) {
  if (confirm("Sei sicuro di voler eliminare questa voce?")) {
    await deleteDoc(doc(db, 'pizze', id));
    caricaPizze();
  }
};

window.logout = async function () {
  await signOut(auth);
  window.location.href = 'login.html';
};

const categorieDiv = document.getElementById('categorieDashboard');
let categoriaFiltro = CATEGORIE[0];

function renderCategorieMenu() {
  categorieDiv.innerHTML = '';
 

  CATEGORIE.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.className = (cat === categoriaFiltro) ? "active" : "";
    btn.onclick = () => {
      categoriaFiltro = cat;
      renderCategorieMenu();
      caricaPizze();
    };
    categorieDiv.appendChild(btn);
  });
}
renderCategorieMenu();


document.getElementById('editPizzaForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!editingId) return;
  const nome = document.getElementById('edit_nome').value;
  const ingredienti = document.getElementById('edit_ingredienti').value;
  const prezzo = document.getElementById('edit_prezzo').value;
  const categoria = document.getElementById('edit_categoria').value;
  const immagineFile = document.getElementById('edit_immagine').files[0];

  let updateData = { nome, ingredienti, prezzo, categoria };

  // Trova la pizza corrente
  const pizza = window.pizzeData.find(p => p.id === editingId);

  if (immagineFile) {
    const categoriaSanificata = categoria.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const storageRef = ref(storage, categoriaSanificata + '/' + immagineFile.name);
    await uploadBytes(storageRef, immagineFile);
    updateData.immagine = await getDownloadURL(storageRef);
  } else if (pizza && !pizza.immagine) {
    // Se l'immagine è stata rimossa
    updateData.immagine = '';
  }

  await updateDoc(doc(db, 'pizze', editingId), updateData);
  editingId = null;
  document.getElementById('editModal').style.display = 'none';
  caricaPizze();
});

document.getElementById('editModal').onclick = function(e) {
  if (e.target === this) {
    this.style.display = 'none';
    editingId = null;
  }
};

document.getElementById('showAddFormBtn').onclick = function() {
  document.getElementById('addModal').style.display = 'flex';
};
document.getElementById('closeAddModal').onclick = function() {
  document.getElementById('addModal').style.display = 'none';
};
document.getElementById('addModal').onclick = function(e) {
  if (e.target === this) this.style.display = 'none';
};

document.getElementById('addModal').style.display = 'none';