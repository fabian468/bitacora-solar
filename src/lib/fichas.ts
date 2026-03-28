// src/lib/fichas.ts
import { db } from './firebase';
import { collection, doc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { FichaPlanta, Cliente } from './types';

const COL = 'fichas';

export async function obtenerFichas(): Promise<FichaPlanta[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FichaPlanta));
}

export async function obtenerFichaDeCliente(cliente: Cliente): Promise<FichaPlanta[]> {
  const q = query(collection(db, COL), where('cliente', '==', cliente));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FichaPlanta));
}

// Usamos plantaNombre como ID del documento para fácil lookup
export async function guardarFicha(data: FichaPlanta): Promise<void> {
  const id = `${data.cliente}__${data.plantaNombre}`.replace(/\s+/g, '_');
  await setDoc(doc(db, COL, id), { ...data, id, updatedAt: Date.now() });
}
