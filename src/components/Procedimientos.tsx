'use client';
// src/components/Procedimientos.tsx
import { useState, useEffect, useRef } from 'react';
import {
  obtenerProcedimientos, crearProcedimiento, actualizarProcedimiento,
  eliminarProcedimiento, subirArchivo, eliminarArchivoUrl,
} from '@/lib/procedimientos';
import { Procedimiento, Paso } from '@/lib/types';
import {
  Plus, X, Edit2, Trash2, Save, Image, Video, Eye,
  ChevronDown, ChevronUp, Loader2, BookMarked, Upload, AlertTriangle,
} from 'lucide-react';

// ── Tipos internos del formulario ─────────────────────────────────────────────

interface PasoForm {
  texto: string;
  imagenesExistentes: string[];
  nuevasImagenes: File[];
}

function pasoVacio(): PasoForm {
  return { texto: '', imagenesExistentes: [], nuevasImagenes: [] };
}

function pasosAForm(pasos: Paso[]): PasoForm[] {
  if (!pasos?.length) return [pasoVacio()];
  return pasos.map(p => ({ texto: p.texto, imagenesExistentes: p.imagenes ?? [], nuevasImagenes: [] }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function contarNuevosArchivos(pasos: PasoForm[], videos: File[]) {
  return pasos.reduce((s, p) => s + p.nuevasImagenes.length, 0) + videos.length;
}

// ── Preview local ─────────────────────────────────────────────────────────────

function PreviewLocal({ file, pequeño = false }: { file: File; pequeño?: boolean }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const cls = pequeño ? 'w-full h-16 object-cover rounded-lg' : 'w-full h-24 object-cover rounded-lg';
  if (file.type.startsWith('video/'))
    return <video src={src} className={`${cls} bg-black`} muted />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={file.name} className={cls} />;
}

// ── Modal Formulario ──────────────────────────────────────────────────────────

function FormModal({ procedimiento, onClose, onGuardado }: {
  procedimiento?: Procedimiento;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState(procedimiento?.titulo ?? '');
  const [pasos, setPasos] = useState<PasoForm[]>(() => pasosAForm(procedimiento?.pasos ?? []));
  const [imagenesGlobExist, setImagenesGlobExist] = useState<string[]>(procedimiento?.imagenes ?? []);
  const [videosExist, setVideosExist] = useState<string[]>(procedimiento?.videos ?? []);
  const [nuevosVideos, setNuevosVideos] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const vidRef = useRef<HTMLInputElement>(null);
  const imgRefs = useRef<(HTMLInputElement | null)[]>([]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const esEdicion = !!procedimiento?.id;

  // ── Pasos ──
  const actualizarTexto = (i: number, val: string) =>
    setPasos(prev => prev.map((p, j) => j === i ? { ...p, texto: val } : p));

  const agregarPaso = (despues?: number) => {
    const idx = despues !== undefined ? despues + 1 : pasos.length;
    setPasos(prev => { const a = [...prev]; a.splice(idx, 0, pasoVacio()); return a; });
    setTimeout(() => textareaRefs.current[idx]?.focus(), 50);
  };

  const eliminarPasoForm = (i: number) => {
    if (pasos.length === 1) { setPasos([pasoVacio()]); return; }
    setPasos(prev => prev.filter((_, j) => j !== i));
  };

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agregarPaso(i); }
    if (e.key === 'Backspace' && pasos[i].texto === '' && pasos.length > 1) {
      e.preventDefault();
      eliminarPasoForm(i);
      setTimeout(() => textareaRefs.current[Math.max(0, i - 1)]?.focus(), 50);
    }
  };

  // imágenes por paso
  const agregarImagenesPaso = (i: number, files: FileList) => {
    setPasos(prev => prev.map((p, j) =>
      j === i ? { ...p, nuevasImagenes: [...p.nuevasImagenes, ...Array.from(files)] } : p,
    ));
  };

  const quitarImagenNuevaPaso = (i: number, fi: number) =>
    setPasos(prev => prev.map((p, j) =>
      j === i ? { ...p, nuevasImagenes: p.nuevasImagenes.filter((_, k) => k !== fi) } : p,
    ));

  const quitarImagenExistPaso = async (i: number, url: string) => {
    await eliminarArchivoUrl(url);
    setPasos(prev => prev.map((p, j) =>
      j === i ? { ...p, imagenesExistentes: p.imagenesExistentes.filter(u => u !== url) } : p,
    ));
  };

  // ── Guardar ──
  const handleGuardar = async () => {
    if (!titulo.trim()) { setError('El título es obligatorio.'); return; }
    const pasosConTexto = pasos.filter(p => p.texto.trim());
    if (pasosConTexto.length === 0) { setError('Agrega al menos un paso.'); return; }

    const totalArchivos = contarNuevosArchivos(pasos, nuevosVideos);
    if (totalArchivos > 0) {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || cloudName === 'Untitled') { setError('Falta NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME en .env.local'); return; }
      if (!preset) { setError('Falta NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET en .env.local'); return; }
    }

    setGuardando(true);
    setError('');
    let subidos = 0;

    try {
      const id = procedimiento?.id ?? `tmp_${Date.now()}`;

      // Subir imágenes de cada paso
      const pasosFinales: Paso[] = [];
      for (const p of pasos) {
        if (!p.texto.trim()) continue;
        const urlsNuevas: string[] = [];
        for (const file of p.nuevasImagenes) {
          urlsNuevas.push(await subirArchivo(file, id));
          subidos++;
          if (totalArchivos > 0) setProgreso(Math.round((subidos / totalArchivos) * 100));
        }
        pasosFinales.push({ texto: p.texto.trim(), imagenes: [...p.imagenesExistentes, ...urlsNuevas] });
      }

      // Subir videos globales
      const urlsVid: string[] = [];
      for (const file of nuevosVideos) {
        urlsVid.push(await subirArchivo(file, id));
        subidos++;
        if (totalArchivos > 0) setProgreso(Math.round((subidos / totalArchivos) * 100));
      }

      const imagenes = imagenesGlobExist;
      const videos = [...videosExist, ...urlsVid];

      if (esEdicion && procedimiento.id) {
        await actualizarProcedimiento(procedimiento.id, { titulo, pasos: pasosFinales, imagenes, videos });
      } else {
        await crearProcedimiento({ titulo, pasos: pasosFinales, imagenes, videos });
      }
      onGuardado();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al guardar.');
      console.error(e);
    } finally {
      setGuardando(false);
      setProgreso(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--c-bg)] border border-[var(--c-border)] rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border-sub)] sticky top-0 bg-[var(--c-bg)] z-10">
          <div className="flex items-center gap-2">
            <BookMarked size={16} className="text-amber-400" />
            <h2 className="font-display font-700 text-sm tracking-widest text-[var(--c-text)]">
              {esEdicion ? 'EDITAR PROCEDIMIENTO' : 'NUEVO PROCEDIMIENTO'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl"><X size={15} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Título */}
          <div>
            <label className="block font-mono text-xs text-slate-500 mb-1.5 tracking-wider">TÍTULO *</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Procedimiento de arranque de inversor"
              className="input-solar w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {/* Pasos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-xs text-slate-500 tracking-wider">PASOS *</label>
              <span className="font-mono text-xs text-slate-600">
                {pasos.filter(p => p.texto.trim()).length} paso{pasos.filter(p => p.texto.trim()).length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {pasos.map((paso, i) => (
                <div key={i} className="group border border-[var(--c-border-sub)] hover:border-amber-500/20 rounded-xl p-3 transition-colors">

                  {/* Fila superior: número + textarea + botones */}
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-7 h-7 mt-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <span className="font-mono text-xs text-amber-400 font-600">{i + 1}</span>
                    </div>

                    <textarea
                      ref={el => { textareaRefs.current[i] = el; }}
                      value={paso.texto}
                      onChange={e => actualizarTexto(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(e, i)}
                      placeholder={`Paso ${i + 1}... (Shift+Enter para salto de línea)`}
                      rows={1}
                      className="input-solar flex-1 rounded-xl px-3 py-2 text-sm resize-none overflow-hidden leading-relaxed"
                      style={{ minHeight: '2.25rem' }}
                      onInput={e => {
                        const t = e.currentTarget;
                        t.style.height = 'auto';
                        t.style.height = t.scrollHeight + 'px';
                      }}
                    />

                    <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
                      {/* Foto en este paso */}
                      <button
                        type="button"
                        onClick={() => imgRefs.current[i]?.click()}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        title="Agregar foto a este paso"
                      >
                        <Image size={13} />
                      </button>
                      <input
                        ref={el => { imgRefs.current[i] = el; }}
                        type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { if (e.target.files) agregarImagenesPaso(i, e.target.files); e.target.value = ''; }}
                      />
                      {/* Agregar paso */}
                      <button
                        onClick={() => agregarPaso(i)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Insertar paso aquí"
                      >
                        <Plus size={13} />
                      </button>
                      {/* Eliminar paso */}
                      <button
                        onClick={() => eliminarPasoForm(i)}
                        className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Eliminar paso"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Imágenes del paso */}
                  {(paso.imagenesExistentes.length > 0 || paso.nuevasImagenes.length > 0) && (
                    <div className="grid grid-cols-4 gap-1.5 mt-2 pl-9">
                      {paso.imagenesExistentes.map(url => (
                        <div key={url} className="relative group/img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-16 object-cover rounded-lg border border-[var(--c-border-sub)]" />
                          <button
                            onClick={() => quitarImagenExistPaso(i, url)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-red-400 opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <X size={9} />
                          </button>
                        </div>
                      ))}
                      {paso.nuevasImagenes.map((f, fi) => (
                        <div key={fi} className="relative group/img">
                          <PreviewLocal file={f} pequeño />
                          <div className="absolute bottom-0.5 left-0.5">
                            <span className="text-xs font-mono text-white/80 bg-black/50 px-1 py-0.5 rounded" style={{ fontSize: '9px' }}>nuevo</span>
                          </div>
                          <button
                            onClick={() => quitarImagenNuevaPaso(i, fi)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-red-400 opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <X size={9} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>

            <button
              onClick={() => agregarPaso()}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[var(--c-border-sub)] text-xs font-mono text-slate-600 hover:border-amber-500/40 hover:text-amber-400 transition-all"
            >
              <Plus size={13} /> Agregar paso
            </button>
          </div>

          {/* Videos globales */}
          <div>
            <label className="block font-mono text-xs text-slate-500 mb-1.5 tracking-wider">VIDEOS</label>
            <button
              type="button"
              onClick={() => vidRef.current?.click()}
              className="btn-ghost px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-dashed border-[var(--c-border-sub)] hover:border-cyan-500/40 hover:text-cyan-400 transition-all w-full justify-center"
            >
              <Video size={13} /> Seleccionar videos
            </button>
            <input ref={vidRef} type="file" accept="video/*" multiple className="hidden"
              onChange={e => { if (e.target.files) setNuevosVideos(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />

            {(videosExist.length > 0 || nuevosVideos.length > 0) && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {videosExist.map(url => (
                  <div key={url} className="relative group">
                    <video src={url} className="w-full h-24 object-cover rounded-lg border border-[var(--c-border-sub)] bg-black" muted />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Video size={20} className="text-white/60" />
                    </div>
                    <button onClick={async () => { await eliminarArchivoUrl(url); setVideosExist(p => p.filter(u => u !== url)); }}
                      className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {nuevosVideos.map((f, i) => (
                  <div key={i} className="relative group">
                    <PreviewLocal file={f} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Video size={20} className="text-white/60" />
                    </div>
                    <button onClick={() => setNuevosVideos(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-mono">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Progreso */}
          {guardando && progreso > 0 && (
            <div>
              <div className="flex justify-between text-xs font-mono text-slate-500 mb-1">
                <span className="flex items-center gap-1"><Upload size={11} /> Subiendo archivos...</span>
                <span>{progreso}%</span>
              </div>
              <div className="h-1.5 bg-[var(--c-inner)] rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--c-border-sub)]">
          <button onClick={onClose} disabled={guardando} className="btn-ghost px-5 py-2 rounded-xl text-sm">Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando}
            className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-2">
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Modal Vista completa ──────────────────────────────────────────────────────

function VerModal({ proc, soloLectura, onClose, onEditar }: {
  proc: Procedimiento;
  soloLectura: boolean;
  onClose: () => void;
  onEditar: () => void;
}) {
  const [imgAmpliada, setImgAmpliada] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[var(--c-bg)] border border-[var(--c-border)] rounded-2xl shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border-sub)] sticky top-0 bg-[var(--c-bg)] z-10">
          <div className="flex items-center gap-2 min-w-0">
            <BookMarked size={16} className="text-amber-400 flex-shrink-0" />
            <h2 className="font-display font-700 text-sm tracking-wide text-[var(--c-text)] truncate">{proc.titulo}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!soloLectura && (
              <button onClick={onEditar} className="btn-ghost px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                <Edit2 size={12} /> Editar
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-2 rounded-xl"><X size={15} /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          <p className="font-mono text-xs text-slate-600">Creado: {formatFecha(proc.createdAt)}</p>

          {/* Pasos */}
          <div>
            <h3 className="font-mono text-xs text-slate-500 tracking-wider mb-4">
              PASOS ({(proc.pasos ?? []).length})
            </h3>
            <ol className="space-y-4">
              {(proc.pasos ?? []).map((paso, i) => (
                <li key={i} className="border border-[var(--c-border-sub)] rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mt-0.5">
                      <span className="font-mono text-xs text-amber-400 font-600">{i + 1}</span>
                    </span>
                    <p className="text-sm text-[var(--c-text-2)] leading-relaxed whitespace-pre-wrap pt-0.5 flex-1">
                      {paso.texto}
                    </p>
                  </div>

                  {/* Imágenes del paso */}
                  {(paso.imagenes ?? []).length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pl-10">
                      {paso.imagenes!.map((url, j) => (
                        <button key={j} onClick={() => setImgAmpliada(url)} className="group block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Paso ${i + 1} img ${j + 1}`}
                            className="w-full h-20 object-cover rounded-lg border border-[var(--c-border-sub)] group-hover:border-amber-500/40 transition-all" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Videos globales */}
          {(proc.videos ?? []).length > 0 && (
            <div>
              <h3 className="font-mono text-xs text-slate-500 tracking-wider mb-3 flex items-center gap-1.5">
                <Video size={11} /> VIDEOS ({proc.videos!.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proc.videos!.map((url, i) => (
                  <video key={i} src={url} controls
                    className="w-full rounded-xl border border-[var(--c-border-sub)] bg-black" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {imgAmpliada && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImgAmpliada(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgAmpliada} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function CardProcedimiento({ proc, soloLectura, onVer, onEditar, onEliminar }: {
  proc: Procedimiento;
  soloLectura: boolean;
  onVer: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const pasos = proc.pasos ?? [];
  const nVids = (proc.videos ?? []).length;
  const nImgsPasos = pasos.reduce((s, p) => s + (p.imagenes?.length ?? 0), 0);
  const primeraImg = pasos.find(p => p.imagenes?.length)?.imagenes?.[0];
  const pasosVista = expandido ? pasos : pasos.slice(0, 3);

  return (
    <div className="card-solar rounded-2xl overflow-hidden border border-[var(--c-border-sub)] hover:border-amber-500/20 transition-all">
      {primeraImg && (
        <div className="h-32 overflow-hidden bg-[var(--c-inner)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={primeraImg} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-600 text-sm text-[var(--c-text)] leading-snug line-clamp-2 flex-1">
            {proc.titulo}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {nImgsPasos > 0 && (
              <span className="flex items-center gap-0.5 font-mono text-xs text-slate-500">
                <Image size={10} />{nImgsPasos}
              </span>
            )}
            {nVids > 0 && (
              <span className="flex items-center gap-0.5 font-mono text-xs text-slate-500">
                <Video size={10} />{nVids}
              </span>
            )}
          </div>
        </div>

        {pasos.length > 0 && (
          <ol className="space-y-1.5">
            {pasosVista.map((paso, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mt-px">
                  <span className="font-mono text-[10px] text-amber-400 font-600">{i + 1}</span>
                </span>
                <span className="text-xs text-slate-500 leading-relaxed line-clamp-2 whitespace-pre-wrap">{paso.texto}</span>
              </li>
            ))}
          </ol>
        )}

        {pasos.length > 3 && (
          <button onClick={() => setExpandido(!expandido)}
            className="text-xs font-mono text-slate-600 hover:text-amber-400 flex items-center gap-1 transition-colors">
            {expandido ? <><ChevronUp size={11} /> Ver menos</> : <><ChevronDown size={11} /> +{pasos.length - 3} pasos más</>}
          </button>
        )}

        <p className="font-mono text-xs text-slate-700">{formatFecha(proc.createdAt)}</p>

        <div className="flex items-center gap-2 pt-1 border-t border-[var(--c-border-sub)]">
          <button onClick={onVer}
            className="btn-ghost px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 flex-1 justify-center">
            <Eye size={12} /> Ver
          </button>
          {!soloLectura && (
            <button onClick={onEditar}
              className="btn-ghost px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 flex-1 justify-center">
              <Edit2 size={12} /> Editar
            </button>
          )}
          {!soloLectura && (!confirmando ? (
            <button onClick={() => setConfirmando(true)}
              className="btn-ghost px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:text-red-400 flex-shrink-0">
              <Trash2 size={12} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={onEliminar}
                className="px-2 py-1.5 rounded-xl text-xs font-mono bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-all">
                Sí
              </button>
              <button onClick={() => setConfirmando(false)} className="px-2 py-1.5 rounded-xl text-xs font-mono btn-ghost">
                No
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Procedimientos({ soloLectura = false }: { soloLectura?: boolean }) {
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Procedimiento | undefined>(undefined);
  const [viendo, setViendo] = useState<Procedimiento | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try { setProcedimientos(await obtenerProcedimientos()); }
    catch { setError('No se pudo cargar los procedimientos.'); }
    finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, []);

  const handleEliminar = async (proc: Procedimiento) => {
    try { await eliminarProcedimiento(proc); await cargar(); }
    catch { setError('Error al eliminar el procedimiento.'); }
  };

  const filtrados = procedimientos.filter(p =>
    !busqueda ||
    p.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.pasos ?? []).some(s => s.texto.toLowerCase().includes(busqueda.toLowerCase())),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Buscar procedimientos..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input-solar w-full rounded-xl pl-9 pr-10 py-2.5 text-sm" />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
        {!soloLectura && (
          <button onClick={() => { setEditando(undefined); setMostrarForm(true); }}
            className="btn-primary px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 flex-shrink-0">
            <Plus size={14} /> NUEVO
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 mb-6 text-red-400 text-sm font-mono">⚠ {error}</div>
      )}

      {cargando && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={28} className="text-amber-400 animate-spin" />
          <p className="font-mono text-sm text-slate-500">Cargando procedimientos...</p>
        </div>
      )}

      {!cargando && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--c-inner)] border border-[var(--c-border-sub)] flex items-center justify-center">
            <BookMarked size={28} className="text-slate-700" />
          </div>
          <div className="text-center">
            <p className="font-display font-600 text-slate-500 text-lg tracking-wide">
              {busqueda ? 'Sin resultados' : 'Sin procedimientos aún'}
            </p>
            <p className="text-slate-600 text-sm mt-1">
              {busqueda ? 'Intenta con otra búsqueda' : 'Crea el primer procedimiento'}
            </p>
          </div>
          {!busqueda && !soloLectura && (
            <button onClick={() => { setEditando(undefined); setMostrarForm(true); }}
              className="btn-primary px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 mt-2">
              <Plus size={15} /> CREAR PROCEDIMIENTO
            </button>
          )}
        </div>
      )}

      {!cargando && filtrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map(proc => (
            <CardProcedimiento
              key={proc.id}
              proc={proc}
              soloLectura={soloLectura}
              onVer={() => setViendo(proc)}
              onEditar={() => { setEditando(proc); setMostrarForm(true); }}
              onEliminar={() => handleEliminar(proc)}
            />
          ))}
        </div>
      )}

      {mostrarForm && (
        <FormModal
          procedimiento={editando}
          onClose={() => { setMostrarForm(false); setEditando(undefined); }}
          onGuardado={cargar}
        />
      )}

      {viendo && (
        <VerModal
          proc={viendo}
          soloLectura={soloLectura}
          onClose={() => setViendo(undefined)}
          onEditar={() => { setEditando(viendo); setViendo(undefined); setMostrarForm(true); }}
        />
      )}
    </div>
  );
}
