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
    value = value.replace(/^["']|["']$/g, '');
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
  const targetName = 'Frittatina la Ciociara';
  const q = query(colRef, or(where('nome', '==', targetName), where('Nome', '==', targetName)));
  const querySnapshot = await getDocs(q);
  
  console.log(`Found ${querySnapshot.size} matches.`);

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    console.log('---');
    console.log('ID:', doc.id);
    const fieldsToPrint = ['nome', 'Nome', 'visible', 'visibile', 'categoria', 'piccantezza', 'spiceLevel', 'spicery'];
    fieldsToPrint.forEach(field => {
       if (data.hasOwnProperty(field)) {
         console.log(`${field}:`, JSON.stringify(data[field]));
       }
    });
  });
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
