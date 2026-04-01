// src/lib/dashboard.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface DashboardConfig {
  metaResolucion: number;    // % objetivo
  metaMTTR: number;          // horas objetivo
  notas: string;
  fotosHabilitadas: boolean; // si false, solo admins pueden subir
  updatedAt?: number;
}

const COL = 'dashboard';
const DOC_ID = 'config';

const DEFAULT: DashboardConfig = { metaResolucion: 80, metaMTTR: 4, notas: '', fotosHabilitadas: true };

export async function obtenerConfig(): Promise<DashboardConfig> {
  const snap = await getDoc(doc(db, COL, DOC_ID));
  return snap.exists() ? (snap.data() as DashboardConfig) : DEFAULT;
}

export async function guardarConfig(data: DashboardConfig): Promise<void> {
  await setDoc(doc(db, COL, DOC_ID), { ...data, updatedAt: Date.now() });
}
