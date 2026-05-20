const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const dotenv = fs.readFileSync(envPath, 'utf8');
  dotenv.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    let value = trimmed.substring(firstEq + 1).trim();
    value = value.replace(/^["'']|["'']$/g, '');
    process.env[key] = value;
  });
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, or } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  const colRef = collection(db, 'menu_items');
  const q = query(colRef, or(where('nome', '==', 'Frittatina la Ciociara'), where('Nome', '==', 'Frittatina la Ciociara')));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    console.log('No matching documents found.');
    process.exit(0);
  }

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    console.log('ID:', doc.id);
    const targetKeys = ['nome', 'Nome', 'ingredienti', 'Ingredienti', 'spicery', 'piccantezza', 'spiceLevel'];
    targetKeys.forEach(key => {
      if (data.hasOwnProperty(key)) {
        console.log(key + ':', JSON.stringify(data[key]));
      }
    });
    console.log('---');
  });
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
