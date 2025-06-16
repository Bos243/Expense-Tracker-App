// Example Firestore setup
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOoF4QPtOlFuagN5Juarrl1hn3TM7Z0So",
  authDomain: "expense-tracker-9f336.firebaseapp.com",
  projectId: "expense-tracker-9f336",
  storageBucket: "expense-tracker-9f336.firebasestorage.app",
  messagingSenderId: "577040943773",
  appId: "1:577040943773:web:5adb1fbe3b0a7fc4a2e274"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };