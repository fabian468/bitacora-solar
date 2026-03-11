'use client';
// src/components/GestionDespachos.tsx
import { useState, useEffect, useCallback } from 'react';
import { Despacho, Planta, Cliente, CLIENTES } from '@/lib/types';
import { crearDespacho, obtenerDespachos, eliminarDespacho, actualizarDespacho } from '@/lib/despachos';
import { obtenerPlantas } from '@/lib/plantas';
import {
  Plus, Trash2, Loader2, RefreshCw, AlertCircle,
  Truck, Hash, Pencil, Check, X, Search
} from 'lucide-react';

const COLORES: Record<Cliente, { bg: string; border: string; text: string; dot: string }> = {
  'Carbon Free': {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  'Matrix': {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function GestionDespachos() {
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Formulario
  const [cliente, setCliente] = useState<Cliente>('Carbon Free');
  const [planta, setPlanta] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [descripcion, setDescripcion] = useState('');

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [desps, plts] = await Promise.all([obtenerDespachos(), obtenerPlantas()]);
      setDespachos(desps);
      setPlantas(plts);
    } catch {
      setError('Error al cargar despachos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Al cambiar cliente, resetear la planta seleccionada
  const plantasPorCliente = plantas.filter(p => p.cliente === cliente);
  useEffect(() => {
    setPlanta(plantasPorCliente[0]?.nombre ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, plantas]);

  const handleCrear = async () => {
    if (!numero.trim()) { setError('Ingresa el número de despacho'); return; }
    if (!planta) { setError('Selecciona una planta'); return; }
    setGuardando(true);
    setError('');
    try {
      await crearDespacho({ planta, cliente, numero: numero.trim(), fecha, descripcion: descripcion.trim() });
      setNumero('');
      setDescripcion('');
      await cargar();
    } catch {
      setError('Error al guardar el despacho');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await eliminarDespacho(id);
      setConfirmDelete(null);
      await cargar();
    } catch {
      setError('Error al eliminar');
    }
  };

  const iniciarEdicion = (d: Despacho) => {
    setEditId(d.id!);
    setEditNumero(d.numero);
    setEditDescripcion(d.descripcion ?? '');
    setConfirmDelete(null);
  };

  const guardarEdicion = async (id: string) => {
    if (!editNumero.trim()) return;
    try {
      await actualizarDespacho(id, { numero: editNumero.trim(), descripcion: editDescripcion.trim() });
      setEditId(null);
      await cargar();
    } catch {
      setError('Error al actualizar');
    }
  };

  const filtrados = despachos.filter(d => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return [d.planta, d.numero, d.descripcion, d.cliente, d.fecha]
      .some(v => v?.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── FORMULARIO ── */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Truck size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-700 text-lg text-white tracking-wide">NUEVO DESPACHO</h2>
            <p className="text-xs text-slate-500">Registra el número de despacho de una planta</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Cliente</label>
            <div className="grid grid-cols-2 gap-3">
              {CLIENTES.map(c => {
                const col = COLORES[c];
                const activo = cliente === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setCliente(c); setError(''); }}
                    className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      activo
                        ? `${col.bg} ${col.border} ${col.text}`
                        : 'border-[#1E2A3A] text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activo ? col.dot : 'bg-slate-700'}`} />
                    <span className="font-display font-600 tracking-wide text-sm">{c}</span>
                    {activo && <span className="ml-auto font-mono text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planta */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Planta</label>
            {plantasPorCliente.length === 0 ? (
              <p className="text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                No hay plantas para este cliente. Agregalas en la sección "PLANTAS".
              </p>
            ) : (
              <select
                value={planta}
                onChange={e => { setPlanta(e.target.value); setError(''); }}
                className="input-solar w-full rounded-xl px-4 py-2.5 text-sm"
              >
                {plantasPorCliente.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Número + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Número de Despacho
              </label>
              <input
                type="text"
                value={numero}
                onChange={e => { setNumero(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCrear()}
                placeholder="Ej: DES-2024-001"
                className="input-solar w-full rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="input-solar w-full rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Descripción opcional */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Descripción <span className="text-slate-600">(opcional)</span>
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCrear()}
              placeholder="Ej: Repuesto inversor SMA, cable 4mm..."
              className="input-solar w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            onClick={handleCrear}
            disabled={guardando || !numero.trim() || !planta}
            className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-700 tracking-wider transition-all ${
              !guardando && numero.trim() && planta
                ? 'btn-primary'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {guardando ? <Loader2 size={15} className="spin-slow" /> : <Plus size={15} />}
            GUARDAR DESPACHO
          </button>
        </div>
      </div>

      {/* ── LISTA ── */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="font-display font-700 text-lg text-white tracking-wide flex items-center gap-2">
            <Hash size={18} className="text-amber-400" />
            DESPACHOS REGISTRADOS
            <span className="font-mono text-xs text-slate-500 font-400">({despachos.length})</span>
          </h2>
          <button onClick={cargar} className="btn-ghost p-2 rounded-lg flex-shrink-0">
            <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
          </button>
        </div>

        {/* Buscador */}
        {despachos.length > 0 && (
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Buscar por número, planta, descripción..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            />
          </div>
        )}

        {cargando && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="spin-slow text-amber-400" />
          </div>
        )}

        {!cargando && despachos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 font-mono text-sm">No hay despachos registrados aún</p>
            <p className="text-slate-600 text-xs mt-1">Agrega el primer despacho arriba</p>
          </div>
        )}

        {!cargando && filtrados.length === 0 && despachos.length > 0 && (
          <p className="text-center text-slate-500 font-mono text-sm py-8">Sin resultados para "{busqueda}"</p>
        )}

        {!cargando && filtrados.length > 0 && (
          <div className="space-y-6">
            {CLIENTES.map(c => {
              const lista = filtrados.filter(d => d.cliente === c);
              if (lista.length === 0) return null;
              const col = COLORES[c];
              return (
                <div key={c}>
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${col.bg} border ${col.border}`}>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`font-display font-700 text-sm tracking-widest ${col.text}`}>{c}</span>
                    <span className={`ml-auto font-mono text-xs ${col.text} opacity-70`}>
                      {lista.length} despacho{lista.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2 pl-2">
                    {lista.map(d => (
                      <div
                        key={d.id}
                        className="bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3 group hover:border-slate-600 transition-all"
                      >
                        {editId === d.id ? (
                          /* ── Modo edición ── */
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editNumero}
                                onChange={e => setEditNumero(e.target.value)}
                                className="input-solar rounded-lg px-3 py-1.5 text-sm"
                                placeholder="Número de despacho"
                              />
                              <input
                                type="text"
                                value={editDescripcion}
                                onChange={e => setEditDescripcion(e.target.value)}
                                className="input-solar rounded-lg px-3 py-1.5 text-sm"
                                placeholder="Descripción (opcional)"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => guardarEdicion(d.id!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-mono"
                              >
                                <Check size={12} /> Guardar
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/40 border border-slate-600/40 text-slate-400 text-xs font-mono"
                              >
                                <X size={12} /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── Vista normal ── */
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-1.5 h-6 rounded-full ${col.dot} opacity-60 flex-shrink-0 mt-0.5`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-amber-400 text-sm font-600">{d.numero}</span>
                                  <span className="text-slate-500 text-xs">·</span>
                                  <span className="text-white text-sm truncate">{d.planta}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="font-mono text-xs text-slate-500">{d.fecha}</span>
                                  {d.descripcion && (
                                    <span className="text-xs text-slate-400 truncate">{d.descripcion}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                              <button
                                onClick={() => iniciarEdicion(d)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                                title="Editar"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleEliminar(d.id!)}
                                className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
                                  confirmDelete === d.id
                                    ? 'bg-red-500/20 border border-red-500/40 text-red-400 opacity-100'
                                    : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'
                                }`}
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                                {confirmDelete === d.id && <span className="font-mono">¿Eliminar?</span>}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
