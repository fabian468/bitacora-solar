// src/lib/fotos.ts
export async function subirFotoBitacora(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const preset   = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  formData.append('folder', 'bitacora');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url);
      } else {
        reject(new Error(`Cloudinary error ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red al subir foto'));
    xhr.send(formData);
  });
}

export async function eliminarFotoBitacora(url: string): Promise<void> {
  try {
    await fetch('/api/cloudinary-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch { /* silenciar */ }
}
