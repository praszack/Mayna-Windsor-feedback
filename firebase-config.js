// Firebase configuration and initialization
// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, orderBy, query, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your Firebase config (you'll get this from Firebase Console)
// IMPORTANT: Replace this with your actual Firebase config
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export for use in other files
window.firebaseDB = db;
window.firebaseCollections = {
  feedback: collection(db, 'feedback')
};

// Firebase helper functions
window.FirebaseHelpers = {
  // Add feedback to Firestore
  async addFeedback(feedbackData) {
    try {
      const docRef = await addDoc(collection(db, 'feedback'), {
        ...feedbackData,
        timestamp: new Date().toISOString(),
        submittedAt: new Date()
      });
      
      console.log("Feedback added with ID: ", docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Error adding feedback: ", error);
      return { success: false, error: error.message };
    }
  },

  // Get all feedback (for admin view)
  async getAllFeedback() {
    try {
      const q = query(collection(db, 'feedback'), orderBy('submittedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const feedbackList = [];
      querySnapshot.forEach((doc) => {
        feedbackList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return { success: true, data: feedbackList };
    } catch (error) {
      console.error("Error getting feedback: ", error);
      return { success: false, error: error.message };
    }
  },

  // Real-time listener for feedback (for admin dashboard)
  listenToFeedback(callback) {
    const q = query(collection(db, 'feedback'), orderBy('submittedAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const feedbackList = [];
      querySnapshot.forEach((doc) => {
        feedbackList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(feedbackList);
    });
  }
};