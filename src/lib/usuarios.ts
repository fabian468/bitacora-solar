// src/lib/usuarios.ts
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Usuario } from './types';

const COL = 'usuarios';

export async function obtenerPerfil(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, COL, uid));
  return snap.exists() ? (snap.data() as Usuario) : null;
}

export async function obtenerUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => d.data() as Usuario);
}

export async function crearPerfil(uid: string, data: Omit<Usuario, 'uid'>): Promise<void> {
  await setDoc(doc(db, COL, uid), { uid, ...data, createdAt: Date.now() });
}

export async function eliminarPerfil(uid: string): Promise<void> {
  await deleteDoc(doc(db, COL, uid));
}
