// src/lib/bitacora.ts
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { RegistroBitacora } from './types';

const COL = 'bitacora';

export async function crearRegistro(data: Omit<RegistroBitacora, 'id' | 'createdAt'>) {
  const docRef = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function obtenerRegistros(): Promise<RegistroBitacora[]> {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroBitacora));
}

export async function actualizarRegistro(id: string, data: Partial<RegistroBitacora>) {
  await updateDoc(doc(db, COL, id), data);
}

export async function eliminarRegistro(id: string) {
  await deleteDoc(doc(db, COL, id));
}
