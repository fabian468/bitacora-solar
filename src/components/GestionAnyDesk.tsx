'use client';
// src/components/GestionAnyDesk.tsx
import { useState, useEffect, useCallback } from 'react';
import { AnyDesk, Planta, Cliente, CLIENTES } from '@/lib/types';
import { crearAnyDesk, obtenerAnyDesks, eliminarAnyDesk, actualizarAnyDesk } from '@/lib/anydesk';
import { obtenerPlantas } from '@/lib/plantas';
import {
  Plus, Trash2, Loader2, X, Monitor, Pencil, Check,
  CheckCircle, Copy, ClipboardCheck, RefreshCw, Search
} from 'lucide-react';

const COLORES: Record<Cliente, { bg: string; border: string; text: string; dot: string }> = {
  'Carbon Free': { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  'Matrix':      { bg: 'bg-cyan-500/10',  border: 'border-cyan-500/30',  text: 'text-cyan-400',  dot: 'bg-cyan-400'  },
};

export default function GestionAnyDesk() {
  const [lista, setLista] = useState<AnyDesk[]>([]);
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [agregados, setAgregados] = useState(0);
  const [ultimoAgregado, setUltimoAgregado] = useState('');

  // Formulario
  const [cliente, setCliente] = useState<Cliente>('Carbon Free');
  const [planta, setPlanta] = useState('');
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editNumero, setEditNumero] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [ads, plts] = await Promise.all([obtenerAnyDesks(), obtenerPlantas()]);
      setLista(ads);
      setPlantas(plts);
    } catch {
      setError('Error al cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const plantasPorCliente = plantas.filter(p => p.cliente === cliente);

  useEffect(() => {
    setPlanta(plantasPorCliente[0]?.nombre ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, plantas]);

  const abrirModal = () => {
    setNombre('');
    setNumero('');
    setAgregados(0);
    setUltimoAgregado('');
    setError('');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    if (agregados > 0) cargar();
  };

  const handleCrear = async () => {
    if (!planta)         { setError('Selecciona una planta'); return; }
    if (!nombre.trim())  { setError('Ingresa un nombre'); return; }
    if (!numero.trim())  { setError('Ingresa el número de AnyDesk'); return; }
    setGuardando(true);
    setError('');
    try {
      await crearAnyDesk({ planta, cliente, nombre: nombre.trim(), numero: numero.trim() });
      setUltimoAgregado(nombre.trim());
      setAgregados(prev => prev + 1);
      setNombre('');
      setNumero('');
    } catch {
      setError('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await eliminarAnyDesk(id);
      setConfirmDelete(null);
      cargar();
    } catch {
      setError('Error al eliminar');
    }
  };

  const iniciarEdicion = (a: AnyDesk) => {
    setEditId(a.id!);
    setEditNombre(a.nombre);
    setEditNumero(a.numero);
    setConfirmDelete(null);
  };

  const guardarEdicion = async (id: string) => {
    if (!editNombre.trim() || !editNumero.trim()) return;
    try {
      await actualizarAnyDesk(id, { nombre: editNombre.trim(), numero: editNumero.trim() });
      setEditId(null);
      cargar();
    } catch {
      setError('Error al actualizar');
    }
  };

  const copiarNumero = async (id: string, num: string) => {
    try { await navigator.clipboard.writeText(num); } catch {
      const el = document.createElement('textarea');
      el.value = num;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const listaFiltrada = busqueda
    ? lista.filter(a => [a.nombre, a.numero, a.planta, a.cliente]
        .some(v => v?.toLowerCase().includes(busqueda.toLowerCase())))
    : lista;

  // Agrupar por cliente → planta
  const grupos = CLIENTES.flatMap(c => {
    const plantasCliente = Array.from(new Set(listaFiltrada.filter(a => a.cliente === c).map(a => a.planta)));
    return plantasCliente.map(p => ({
      cliente: c,
      planta: p,
      items: listaFiltrada.filter(a => a.cliente === c && a.planta === p),
    }));
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

      {/* ── MODAL ── */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl w-full max-w-sm shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border-sub)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Monitor size={15} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-display font-700 text-base text-[var(--c-text)] tracking-wide">NUEVO ANYDESK</h2>
                  {agregados > 0 && (
                    <p className="text-xs text-green-400 font-mono flex items-center gap-1">
                      <CheckCircle size={10} />
                      {agregados} agregado{agregados !== 1 ? 's' : ''} · {ultimoAgregado}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={cerrarModal} className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--c-text-2)] hover:bg-slate-700/50 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Formulario */}
            <div className="px-6 py-5 space-y-4">

              {/* Cliente */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Cliente</label>
                <div className="grid grid-cols-2 gap-2">
                  {CLIENTES.map(c => {
                    const col = COLORES[c];
                    const activo = cliente === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCliente(c); setError(''); }}
                        className={`py-2.5 px-3 rounded-xl border-2 transition-all flex items-center gap-2.5 ${
                          activo ? `${col.bg} ${col.border} ${col.text}` : 'border-[var(--c-border-sub)] text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activo ? col.dot : 'bg-slate-700'}`} />
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
                    No hay plantas para este cliente.
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

              {/* Nombre + Número */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => { setNombre(e.target.value); setError(''); }}
                  placeholder="Ej: Inversor 1, PC Sala..."
                  className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Número AnyDesk</label>
                <input
                  type="text"
                  value={numero}
                  onChange={e => { setNumero(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCrear()}
                  placeholder="123 456 789"
                  className="input-solar w-full rounded-xl px-3 py-2.5 text-sm font-mono"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs font-mono bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleCrear}
                disabled={guardando || !nombre.trim() || !numero.trim() || !planta}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-700 tracking-wider transition-all ${
                  !guardando && nombre.trim() && numero.trim() && planta
                    ? 'btn-primary'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                {guardando ? <Loader2 size={14} className="spin-slow" /> : <Plus size={14} />}
                AGREGAR
              </button>
              <button
                onClick={cerrarModal}
                className="px-4 py-2.5 rounded-xl border border-[var(--c-border)] text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm font-mono transition-all"
              >
                {agregados > 0 ? 'Listo' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LISTA ── */}
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-700 text-lg text-[var(--c-text)] tracking-wide flex items-center gap-2">
            <Monitor size={18} className="text-cyan-400" />
            ACCESO REMOTO
            <span className="font-mono text-xs text-slate-500 font-400">({lista.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={cargar} className="btn-ghost p-2 rounded-lg">
              <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
            </button>
            <button onClick={abrirModal} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-700 tracking-wider">
              <Plus size={14} />
              NUEVO
            </button>
          </div>
        </div>

        {lista.length > 0 && (
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Buscar por nombre, número, planta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            />
          </div>
        )}

        {cargando && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="spin-slow text-cyan-400" />
          </div>
        )}

        {!cargando && lista.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 font-mono text-sm">No hay entradas registradas</p>
            <button onClick={abrirModal} className="mt-3 text-xs text-cyan-400/70 hover:text-cyan-400 font-mono underline underline-offset-2 transition-colors">
              Agregar la primera
            </button>
          </div>
        )}

        {!cargando && busqueda && grupos.length === 0 && (
          <p className="text-center text-slate-500 font-mono text-sm py-8">Sin resultados para "{busqueda}"</p>
        )}

        {!cargando && grupos.length > 0 && (
          <div className="space-y-6">
            {CLIENTES.map(c => {
              const gruposCliente = grupos.filter(g => g.cliente === c);
              if (gruposCliente.length === 0) return null;
              const col = COLORES[c];
              return (
                <div key={c}>
                  {/* Header cliente */}
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${col.bg} border ${col.border}`}>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`font-display font-700 text-sm tracking-widest ${col.text}`}>{c}</span>
                    <span className={`ml-auto font-mono text-xs ${col.text} opacity-70`}>
                      {gruposCliente.reduce((acc, g) => acc + g.items.length, 0)} acceso{gruposCliente.reduce((acc, g) => acc + g.items.length, 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-4 pl-2">
                    {gruposCliente.map(grupo => (
                      <div key={grupo.planta}>
                        {/* Header planta */}
                        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span className={`w-1 h-3 rounded-full ${col.dot} opacity-50`} />
                          {grupo.planta}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {grupo.items.map(a => (
                            <div
                              key={a.id}
                              className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-3 group hover:border-slate-600 transition-all"
                            >
                              {editId === a.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editNombre}
                                    onChange={e => setEditNombre(e.target.value)}
                                    className="input-solar w-full rounded-lg px-3 py-1.5 text-sm"
                                    placeholder="Nombre"
                                  />
                                  <input
                                    type="text"
                                    value={editNumero}
                                    onChange={e => setEditNumero(e.target.value)}
                                    className="input-solar w-full rounded-lg px-3 py-1.5 text-sm font-mono"
                                    placeholder="Número AnyDesk"
                                  />
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => guardarEdicion(a.id!)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-mono"
                                    >
                                      <Check size={11} /> Guardar
                                    </button>
                                    <button
                                      onClick={() => setEditId(null)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/40 border border-slate-600/40 text-slate-400 text-xs font-mono"
                                    >
                                      <X size={11} /> Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[var(--c-text)] text-sm font-500 truncate">{a.nombre}</p>
                                    <p className="font-mono text-cyan-400 text-sm tracking-widest mt-0.5">{a.numero}</p>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => copiarNumero(a.id!, a.numero)}
                                      className={`p-1.5 rounded-lg transition-all ${
                                        copiadoId === a.id
                                          ? 'text-green-400 bg-green-400/10'
                                          : 'text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/10 opacity-0 group-hover:opacity-100'
                                      }`}
                                      title="Copiar número"
                                    >
                                      {copiadoId === a.id ? <ClipboardCheck size={13} /> : <Copy size={13} />}
                                    </button>
                                    <button
                                      onClick={() => iniciarEdicion(a)}
                                      className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-amber-400/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleEliminar(a.id!)}
                                      className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
                                        confirmDelete === a.id
                                          ? 'bg-red-500/20 border border-red-500/40 text-red-400 opacity-100'
                                          : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      <Trash2 size={12} />
                                      {confirmDelete === a.id && <span className="font-mono">¿Eliminar?</span>}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
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
