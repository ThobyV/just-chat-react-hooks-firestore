import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'

firebase.initializeApp({
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_DATABASE_URL,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID
});

const google_auth_provider = new firebase.auth.GoogleAuthProvider();

const firestoreDb = firebase.firestore;
const usersCollection = firestoreDb().collection('users');
const chatsCollection = firestoreDb().collection('chats');

export {
  google_auth_provider,
  firestoreDb,
  usersCollection,
  chatsCollection,
}

export default firebase;