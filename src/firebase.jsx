import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8GyfFl5ft_AIuyC8Awju2PUDJt-QxwCQ",
  authDomain: "boardgamenight-5863e.firebaseapp.com",
  projectId: "boardgamenight-5863e",
  storageBucket: "boardgamenight-5863e.firebasestorage.app",
  messagingSenderId: "240049542458",
  appId: "1:240049542458:web:99bf27988031b4a0e82c03"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
