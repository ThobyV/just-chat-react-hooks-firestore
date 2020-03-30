import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'

firebase.initializeApp({
  apiKey: "AIzaSyAbEwWfoLoV9wnKdKqOCjjjsY99nq1Gmik",
  authDomain: "chatty-73efb.firebaseapp.com",
  databaseURL: "https://chatty-73efb.firebaseio.com",
  projectId: "chatty-73efb",
  storageBucket: "chatty-73efb.appspot.com",
  messagingSenderId: "545290861873"
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