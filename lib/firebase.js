// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCGXgDGVrXnpLEnMdl0_X8-dBkMk8khJdI",
  authDomain: "cashiersystem-8d1ea.firebaseapp.com",
  projectId: "cashiersystem-8d1ea",
  storageBucket: "cashiersystem-8d1ea.appspot.com",
  messagingSenderId: "146509041713",
  appId: "1:146509041713:web:d3584aca70abe09b888510",
  measurementId: "G-TVYJQ193Q5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
