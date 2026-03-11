// src/lib/despachos.ts
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Despacho } from './types';

const COL = 'despachos';

export async function crearDespacho(data: Omit<Despacho, 'id' | 'createdAt'>) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function obtenerDespachos(): Promise<Despacho[]> {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Despacho));
}

export async function actualizarDespacho(id: string, data: Partial<Despacho>) {
  await updateDoc(doc(db, COL, id), data);
}

export async function eliminarDespacho(id: string) {
  await deleteDoc(doc(db, COL, id));
}
