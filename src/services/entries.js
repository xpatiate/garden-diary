import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, getDoc, query, orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';

function entriesCol(userId) {
  return collection(db, 'users', userId, 'entries');
}

export async function createEntry(userId, data) {
  return addDoc(entriesCol(userId), {
    textNote: '',
    voiceTranscript: '',
    photoRefs: [],
    tags: [],
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateEntry(userId, entryId, data) {
  return updateDoc(doc(db, 'users', userId, 'entries', entryId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEntry(userId, entryId) {
  return deleteDoc(doc(db, 'users', userId, 'entries', entryId));
}

export async function getEntries(userId, limitCount = 100) {
  const q = query(entriesCol(userId), orderBy('date', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEntry(userId, entryId) {
  const snap = await getDoc(doc(db, 'users', userId, 'entries', entryId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
