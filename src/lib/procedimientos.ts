// src/lib/procedimientos.ts
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Procedimiento, Paso } from './types';

const COL = 'procedimientos';

// ── Cloudinary ────────────────────────────────────────────────────────────────

export async function subirArchivo(
  file: File,
  _procedimientoId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
  const resourceType = file.type.startsWith('video/') ? 'video' : 'image';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  formData.append('folder', 'procedimientos');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        resolve(res.secure_url as string);
      } else {
        reject(new Error(`Cloudinary error: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
    xhr.send(formData);
  });
}

export async function eliminarArchivoUrl(url: string) {
  try {
    await fetch('/api/cloudinary-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch {
    // Ignorar errores de eliminación
  }
}

// ── CRUD Firestore ────────────────────────────────────────────────────────────

export async function crearProcedimiento(
  data: Omit<Procedimiento, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const pasos: Paso[] = (data.pasos ?? []).map(p => ({
    texto: p.texto,
    imagenes: p.imagenes ?? [],
  }));
  const docRef = await addDoc(collection(db, COL), {
    ...data,
    pasos,
    imagenes: data.imagenes ?? [],
    videos: data.videos ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
}

export async function obtenerProcedimientos(): Promise<Procedimiento[]> {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Procedimiento));
}

export async function actualizarProcedimiento(id: string, data: Partial<Procedimiento>) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: Date.now() });
}

export async function eliminarProcedimiento(proc: Procedimiento) {
  if (!proc.id) return;
  const urlsPasos = (proc.pasos ?? []).flatMap(p => p.imagenes ?? []);
  const urls = [...(proc.imagenes ?? []), ...(proc.videos ?? []), ...urlsPasos];
  await Promise.allSettled(urls.map(u => eliminarArchivoUrl(u)));
  await deleteDoc(doc(db, COL, proc.id));
}
