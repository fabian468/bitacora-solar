// src/lib/anydesk.ts
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { AnyDesk } from './types';

const COL = 'anydesk';

export async function crearAnyDesk(data: Omit<AnyDesk, 'id' | 'createdAt'>) {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function obtenerAnyDesks(): Promise<AnyDesk[]> {
  const q = query(collection(db, COL), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AnyDesk));
}

export async function actualizarAnyDesk(id: string, data: Partial<AnyDesk>) {
  await updateDoc(doc(db, COL, id), data);
}

export async function eliminarAnyDesk(id: string) {
  await deleteDoc(doc(db, COL, id));
}
