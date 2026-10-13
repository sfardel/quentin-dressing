import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function createFirebaseStore(firebaseConfig) {
  const db = getFirestore(initializeApp(firebaseConfig));
  const items = collection(db, "items");

  return {
    subscribe(onChange, onError) {
      return onSnapshot(
        query(items, orderBy("createdAt")),
        (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      );
    },
    async addItem({ zone, item, name }) {
      await addDoc(items, { zone, item, name, createdAt: serverTimestamp() });
    },
    async deleteItem(id) {
      await deleteDoc(doc(items, id));
    },
  };
}
