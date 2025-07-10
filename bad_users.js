import env from "react-native-dotenv";
require('dotenv').config();


console.log(process.env)



const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");


const firebaseConfig = {
    apiKey: pocess.env.API_KEY,
    authDomain: "kumon-check-in-app.firebaseapp.com",
    projectId: "kumon-check-in-app",
    storageBucket: "kumon-check-in-app.appspot.com",
    messagingSenderId: "353659189856",
    appId: "1:353659189856:web:4b42b8d77783fe81b06105",
    measurementId: "G-91QX46NDPL"
  };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanBadUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  for (const document of snapshot.docs) {
    const data = document.data();
    if (data.name && data.name.includes('${')) {
      await deleteDoc(doc(db, "users", document.id));
      console.log(`❌ Deleted bad entry: ${data.name}`);
    }
  }
}

cleanBadUsers();
