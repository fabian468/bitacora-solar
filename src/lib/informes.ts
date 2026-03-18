// src/lib/informes.ts
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { InformeGuardado } from './types';

const COL = 'informes';

export async function guardarInforme(data: Omit<InformeGuardado, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function obtenerInformes(): Promise<InformeGuardado[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InformeGuardado));
}

export async function eliminarInforme(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
