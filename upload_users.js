const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");
const users = require("./users.json");

const firebaseConfig = {
  apiKey: "AIzaSyA49hVXYCBuSDfKqCoi94kQ1cKdnVXglsQ",
  authDomain: "kumon-check-in-app.firebaseapp.com",
  projectId: "kumon-check-in-app",
  storageBucket: "kumon-check-in-app.appspot.com",
  messagingSenderId: "353659189856",
  appId: "1:353659189856:web:4b42b8d77783fe81b06105",
  measurementId: "G-91QX46NDPL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function upload() {
  for (const user of users) {
    const first = user["First Name"]?.trim();
    const last = user["Last Name"]?.trim();

    if (!first || !last) {
      console.log("❌ Skipping invalid user:", user);
      continue;
    }

    const fullName = `${first} ${last}`;

    await addDoc(collection(db, "users"), {
      name: fullName
    });

    console.log(`✅ Uploaded: ${fullName}`);
  }
}

upload();
