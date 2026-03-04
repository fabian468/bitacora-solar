'use client';
// src/components/EscanearCuaderno.tsx
import { useState, useRef, useCallback } from 'react';
import { crearRegistro } from '@/lib/bitacora';
import { Planta, Cliente, CLIENTES, RegistroBitacora } from '@/lib/types';
import {
  X, Camera, Upload, Loader2, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, BookOpen, Scan,
  Check, Save, RotateCcw
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onGuardados: () => void;
  plantas: Planta[];
}

type Estado = 'subir' | 'analizando' | 'revisar' | 'guardando' | 'listo';

interface RegistroRevisado extends Omit<RegistroBitacora, 'id' | 'createdAt'> {
  _idx: number;
  _seleccionado: boolean;
  _expandido: boolean;
  _guardado?: boolean;
}

const CLIENTE_ESTILOS: Record<Cliente, { activo: string; inactivo: string; dot: string }> = {
  'Carbon Free': {
    activo: 'bg-green-500/20 border-green-500/50 text-green-400',
    inactivo: 'border-[#2A3F5A] text-slate-500 hover:border-green-500/30 hover:text-green-400',
    dot: 'bg-green-400',
  },
  'Matrix': {
    activo: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
    inactivo: 'border-[#2A3F5A] text-slate-500 hover:border-cyan-500/30 hover:text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function EscanearCuaderno({ onClose, onGuardados, plantas }: Props) {
  const [estado, setEstado] = useState<Estado>('subir');
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RegistroRevisado[]>([]);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [clienteDefault, setClienteDefault] = useState<Cliente>('Carbon Free');
  const [contadorGuardados, setContadorGuardados] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);

  // Plantas filtradas por cliente seleccionado
  const plantasFiltradas = plantas.filter(p => p.cliente === clienteDefault);
  const plantaDefault = plantasFiltradas[0]?.nombre ?? '';

  const procesarImagen = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImagenPreview(base64);
      setImagenBase64(base64);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) procesarImagen(file);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarImagen(file);
  };

  const analizar = async () => {
    if (!imagenBase64) return;
    setEstado('analizando');
    setError('');

    try {
      const res = await fetch('/api/escanear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen: imagenBase64, plantaDefault }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error desconocido');

      if (!data.registros || data.registros.length === 0) {
        setError('No se encontraron registros en la imagen. Intenta con una foto más clara.');
        setEstado('subir');
        return;
      }

      const revisados: RegistroRevisado[] = data.registros.map(
        (r: Omit<RegistroBitacora, 'id' | 'createdAt'>, i: number) => ({
          ...r,
          cliente: clienteDefault,
          _idx: i,
          _seleccionado: true,
          _expandido: i === 0,
        })
      );

      setRegistros(revisados);
      setNota(data.nota || '');
      setEstado('revisar');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al analizar: ${msg}`);
      setEstado('subir');
    }
  };

  const toggleSeleccion = (idx: number) =>
    setRegistros(prev => prev.map(r => r._idx === idx ? { ...r, _seleccionado: !r._seleccionado } : r));

  const toggleExpandido = (idx: number) =>
    setRegistros(prev => prev.map(r => r._idx === idx ? { ...r, _expandido: !r._expandido } : r));

  const actualizarCampo = (idx: number, campo: string, valor: string) =>
    setRegistros(prev => prev.map(r => r._idx === idx ? { ...r, [campo]: valor } : r));

  const guardarSeleccionados = async () => {
    const seleccionados = registros.filter(r => r._seleccionado && !r._guardado);
    if (seleccionados.length === 0) return;

    setEstado('guardando');
    let guardados = 0;

    for (const r of seleccionados) {
      try {
        const { _idx, _seleccionado, _expandido, _guardado, ...datos } = r;
        await crearRegistro(datos);
        guardados++;
        setRegistros(prev => prev.map(reg => reg._idx === r._idx ? { ...reg, _guardado: true } : reg));
        setContadorGuardados(guardados);
      } catch {
        // continuar con el siguiente
      }
    }

    setEstado('listo');
    onGuardados();
  };

  const reiniciar = () => {
    setEstado('subir');
    setImagenPreview(null);
    setImagenBase64(null);
    setRegistros([]);
    setNota('');
    setError('');
    setContadorGuardados(0);
  };

  const seleccionados = registros.filter(r => r._seleccionado && !r._guardado).length;
  const yaGuardados = registros.filter(r => r._guardado).length;

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0D1321] border border-[#2A3F5A] rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A3F5A] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <BookOpen size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="font-display font-700 text-xl text-white tracking-wide">ESCANEAR CUADERNO</h2>
              <p className="text-xs text-slate-500">Digitaliza registros escritos a mano con IA</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 py-3 border-b border-[#1A2535] flex items-center gap-2 flex-shrink-0">
          {[
            { key: 'subir', label: '1. Foto' },
            { key: 'analizando', label: '2. Analizando' },
            { key: 'revisar', label: '3. Revisar' },
            { key: 'listo', label: '4. Listo' },
          ].map((step, i, arr) => {
            const activo = estado === step.key || (estado === 'guardando' && step.key === 'revisar');
            const completado =
              (step.key === 'subir' && ['analizando', 'revisar', 'guardando', 'listo'].includes(estado)) ||
              (step.key === 'analizando' && ['revisar', 'guardando', 'listo'].includes(estado)) ||
              (step.key === 'revisar' && ['listo'].includes(estado));
            return (
              <div key={step.key} className="flex items-center gap-2">
                <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                  completado ? 'text-green-400 bg-green-400/10' :
                  activo ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/30' :
                  'text-slate-600'
                }`}>
                  {completado ? '✓' : ''} {step.label}
                </span>
                {i < arr.length - 1 && <span className="text-slate-700">→</span>}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── PASO 1: SUBIR ── */}
          {estado === 'subir' && (
            <div className="space-y-5">

              {/* Selector de cliente */}
              <div className="space-y-2">
                <label className="text-xs font-display uppercase tracking-widest text-slate-400">
                  Cliente
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CLIENTES.map(c => {
                    const est = CLIENTE_ESTILOS[c];
                    const count = plantas.filter(p => p.cliente === c).length;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setClienteDefault(c)}
                        className={`py-2.5 px-4 rounded-xl border-2 transition-all flex items-center gap-2 text-sm font-display font-600 tracking-wide ${
                          clienteDefault === c ? est.activo : est.inactivo
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clienteDefault === c ? est.dot : 'bg-slate-700'}`} />
                        {c}
                        <span className="ml-auto text-xs font-mono opacity-60">{count} plantas</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Planta por defecto */}
              <div className="space-y-1">
                <label className="text-xs font-display uppercase tracking-widest text-slate-400">
                  Planta por defecto
                </label>
                {plantasFiltradas.length === 0 ? (
                  <div className="input-solar w-full rounded-lg px-3 py-2.5 text-sm text-slate-500">
                    No hay plantas para {clienteDefault} — ve a la pestaña PLANTAS
                  </div>
                ) : (
                  <select
                    value={plantaDefault}
                    onChange={e => {
                      // Solo actualiza la selección visual; el valor real viene de plantaDefault
                      const nueva = plantasFiltradas.find(p => p.nombre === e.target.value);
                      if (nueva) {
                        // Forzar re-render actualizando clienteDefault a sí mismo (hack simple)
                        setClienteDefault(prev => prev);
                      }
                    }}
                    className="input-solar w-full rounded-lg px-3 py-2 text-sm"
                  >
                    {plantasFiltradas.map(p => (
                      <option key={p.id} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-slate-600">Se usará si la planta no aparece en el cuaderno</p>
              </div>

              {/* Zona de carga */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-[#2A3F5A] rounded-2xl p-8 text-center hover:border-cyan-500/50 transition-colors cursor-pointer"
                onClick={() => inputRef.current?.click()}
              >
                {imagenPreview ? (
                  <div className="space-y-3">
                    <img src={imagenPreview} alt="Vista previa"
                      className="max-h-64 mx-auto rounded-xl object-contain" />
                    <p className="text-xs text-slate-400">Imagen cargada ✓ — haz click para cambiar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Upload size={28} className="text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white font-500">Arrastra una foto aquí</p>
                      <p className="text-slate-500 text-sm mt-1">o haz click para seleccionar</p>
                    </div>
                    <p className="text-xs text-slate-600">JPG, PNG, WEBP — máximo 5MB</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => camaraRef.current?.click()}
                className="w-full py-3 rounded-xl border border-[#2A3F5A] text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Camera size={16} /> Tomar foto con cámara
              </button>

              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button
                onClick={analizar}
                disabled={!imagenBase64}
                className={`w-full py-3 rounded-xl font-display font-700 text-sm flex items-center justify-center gap-2 tracking-wider ${
                  imagenBase64 ? 'btn-primary' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Scan size={16} /> ANALIZAR CON IA
              </button>
            </div>
          )}

          {/* ── PASO 2: ANALIZANDO ── */}
          {estado === 'analizando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <BookOpen size={36} className="text-cyan-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                  <Loader2 size={14} className="text-black spin-slow" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="font-display font-700 text-xl text-white tracking-wide">ANALIZANDO IMAGEN</p>
                <p className="text-slate-500 text-sm">La IA está leyendo el cuaderno y extrayendo los registros...</p>
                <div className="flex items-center justify-center gap-1 mt-4">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-cyan-400"
                      style={{ animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3: REVISAR ── */}
          {(estado === 'revisar' || estado === 'guardando') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-slate-400">
                    Encontrados: <span className="text-cyan-400 font-500">{registros.length}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Seleccionados: <span className="text-amber-400 font-500">{seleccionados + yaGuardados}</span>
                  </span>
                  {yaGuardados > 0 && (
                    <span className="font-mono text-xs text-slate-400">
                      Guardados: <span className="text-green-400 font-500">{yaGuardados}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setRegistros(prev => prev.map(r => ({ ...r, _seleccionado: true })))}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Todos</button>
                  <span className="text-slate-700">|</span>
                  <button onClick={() => setRegistros(prev => prev.map(r => ({ ...r, _seleccionado: false })))}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Ninguno</button>
                </div>
              </div>

              {nota && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-amber-400 text-xs flex items-start gap-2">
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{nota}</span>
                </div>
              )}

              <div className="space-y-3">
                {registros.map(r => {
                  // Plantas disponibles para este registro (mismo cliente)
                  const plantasRegistro = plantas.filter(p => p.cliente === r.cliente);
                  return (
                    <div key={r._idx}
                      className={`rounded-xl border transition-all ${
                        r._guardado ? 'border-green-500/30 bg-green-500/5' :
                        r._seleccionado ? 'border-cyan-500/30 bg-[#0D1B2A]' :
                        'border-[#1E2A3A] bg-[#0A0E1A] opacity-60'
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => !r._guardado && toggleSeleccion(r._idx)}
                          disabled={!!r._guardado}
                          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                            r._guardado ? 'bg-green-500/20 border-green-500/40' :
                            r._seleccionado ? 'bg-cyan-500/20 border-cyan-500/40' :
                            'border-slate-700'
                          }`}
                        >
                          {r._guardado ? <Check size={11} className="text-green-400" /> :
                           r._seleccionado ? <Check size={11} className="text-cyan-400" /> : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">#{r._idx + 1}</span>
                            {r._guardado && (
                              <span className="badge bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                ✓ Guardado
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white font-500 truncate">{r.acontecimiento || 'Sin título'}</p>
                          <p className="font-mono text-xs text-slate-500">{r.planta} · {r.fechaInicio} {r.horaInicio}</p>
                        </div>
                        {!r._guardado && (
                          <button onClick={() => toggleExpandido(r._idx)} className="btn-ghost p-1.5 rounded-lg">
                            {r._expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>

                      {/* Formulario expandible */}
                      {r._expandido && !r._guardado && (
                        <div className="px-4 pb-4 space-y-3 border-t border-[#1E2A3A] pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-mono text-slate-500 uppercase">Planta</label>
                              {plantasRegistro.length > 0 ? (
                                <select
                                  value={r.planta}
                                  onChange={e => actualizarCampo(r._idx, 'planta', e.target.value)}
                                  className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
                                >
                                  {plantasRegistro.map(p => (
                                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={r.planta}
                                  onChange={e => actualizarCampo(r._idx, 'planta', e.target.value)}
                                  className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-xs font-mono text-slate-500 uppercase">Acontecimiento</label>
                              <input
                                value={r.acontecimiento}
                                onChange={e => actualizarCampo(r._idx, 'acontecimiento', e.target.value)}
                                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-mono text-slate-500 uppercase">Causa</label>
                            <input
                              value={r.causa}
                              onChange={e => actualizarCampo(r._idx, 'causa', e.target.value)}
                              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-mono text-slate-500 uppercase">Detalle</label>
                            <textarea rows={2} value={r.detalle}
                              onChange={e => actualizarCampo(r._idx, 'detalle', e.target.value)}
                              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['fechaInicio', 'horaInicio', 'fechaFin', 'horaFin'].map(campo => (
                              <div key={campo}>
                                <label className="text-xs font-mono text-slate-500 uppercase">
                                  {campo === 'fechaInicio' ? 'F. Inicio' : campo === 'horaInicio' ? 'H. Inicio' : campo === 'fechaFin' ? 'F. Fin' : 'H. Fin'}
                                </label>
                                <input
                                  type={campo.includes('hora') ? 'time' : 'date'}
                                  value={r[campo as keyof RegistroRevisado] as string}
                                  onChange={e => actualizarCampo(r._idx, campo, e.target.value)}
                                  className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={reiniciar}
                  className="btn-ghost px-4 py-2.5 rounded-xl text-sm font-display font-600 uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw size={14} /> Nueva foto
                </button>
                <button
                  onClick={guardarSeleccionados}
                  disabled={seleccionados === 0 || estado === 'guardando'}
                  className={`flex-1 py-2.5 rounded-xl font-display font-700 text-sm flex items-center justify-center gap-2 tracking-wider ${
                    seleccionados > 0 && estado !== 'guardando'
                      ? 'btn-primary'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {estado === 'guardando'
                    ? <><Loader2 size={15} className="spin-slow" /> Guardando...</>
                    : <><Save size={15} /> GUARDAR {seleccionados} REGISTRO{seleccionados !== 1 ? 'S' : ''}</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 4: LISTO ── */}
          {estado === 'listo' && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-display font-700 text-2xl text-white tracking-wide">¡DIGITALIZADO!</p>
                <p className="text-slate-400">
                  Se guardaron <span className="text-green-400 font-600">{yaGuardados} registros</span> en la bitácora
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={reiniciar}
                  className="btn-ghost px-6 py-2.5 rounded-xl text-sm font-display font-600 uppercase tracking-wider">
                  Escanear otra página
                </button>
                <button onClick={onClose} className="btn-primary px-6 py-2.5 rounded-xl text-sm">
                  VER BITÁCORA
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
