// src/lib/plantas.ts
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Planta } from './types';

const COL = 'plantas';

export async function crearPlanta(data: Omit<Planta, 'id' | 'createdAt'>) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function obtenerPlantas(): Promise<Planta[]> {
  const q = query(collection(db, COL), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Planta));
}

export async function eliminarPlanta(id: string) {
  await deleteDoc(doc(db, COL, id));
}
