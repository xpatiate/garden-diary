import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';

function todosCol(userId) {
  return collection(db, 'users', userId, 'todos');
}

export async function getTodos(userId) {
  const q = query(todosCol(userId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addTodo(userId, text, dueMonth = null) {
  return addDoc(todosCol(userId), {
    text,
    done: false,
    dueMonth,
    createdAt: serverTimestamp(),
  });
}

export async function toggleTodo(userId, todoId, done) {
  return updateDoc(doc(db, 'users', userId, 'todos', todoId), { done });
}

export async function deleteTodo(userId, todoId) {
  return deleteDoc(doc(db, 'users', userId, 'todos', todoId));
}
