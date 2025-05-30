// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA49hVXYCBuSDfKqCoi94kQ1cKdnVXglsQ",
  authDomain: "kumon-check-in-app.firebaseapp.com",
  projectId: "kumon-check-in-app",
  storageBucket: "kumon-check-in-app.firebasestorage.app",
  messagingSenderId: "353659189856",
  appId: "1:353659189856:web:4b42b8d77783fe81b06105",
  measurementId: "G-91QX46NDPL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);