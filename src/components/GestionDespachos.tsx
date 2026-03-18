'use client';
// src/components/GestionDespachos.tsx
import { useState, useEffect, useCallback } from 'react';
import { Despacho, Planta, Cliente, CLIENTES } from '@/lib/types';
import { crearDespacho, obtenerDespachos, eliminarDespacho, actualizarDespacho } from '@/lib/despachos';
import { obtenerPlantas } from '@/lib/plantas';
import {
  Plus, Trash2, Loader2, RefreshCw, AlertCircle,
  Truck, Hash, Pencil, Check, X, Search, CheckCircle
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
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [agregados, setAgregados] = useState(0);
  const [ultimoAgregado, setUltimoAgregado] = useState('');

  // Formulario
  const [cliente, setCliente] = useState<Cliente>('Carbon Free');
  const [planta, setPlanta] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [alimentador, setAlimentador] = useState('');
  const [subestacion, setSubestacion] = useState('');
  const [direccion, setDireccion] = useState('');

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState('');

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

  const plantasPorCliente = plantas.filter(p => p.cliente === cliente);
  useEffect(() => {
    setPlanta(plantasPorCliente[0]?.nombre ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, plantas]);

  const abrirModal = () => {
    setAgregados(0);
    setUltimoAgregado('');
    setNumero('');
    setAlimentador('');
    setSubestacion('');
    setDireccion('');
    setError('');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    if (agregados > 0) cargar();
  };

  const handleCrear = async () => {
    if (!numero.trim()) { setError('Ingresa el número de despacho'); return; }
    if (!planta) { setError('Selecciona una planta'); return; }
    setGuardando(true);
    setError('');
    try {
      await crearDespacho({
        planta, cliente, numero: numero.trim(), fecha,
        alimentador: alimentador.trim(),
        subestacion: subestacion.trim(),
        direccion: direccion.trim(),
      });
      setUltimoAgregado(numero.trim());
      setAgregados(prev => prev + 1);
      setNumero('');
      setAlimentador('');
      setSubestacion('');
      setDireccion('');
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
    setConfirmDelete(null);
  };

  const guardarEdicion = async (id: string) => {
    if (!editNumero.trim()) return;
    try {
      await actualizarDespacho(id, { numero: editNumero.trim() });
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
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

      {/* ── MODAL ── */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl w-full max-w-md shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border-sub)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Truck size={15} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="font-display font-700 text-base text-[var(--c-text)] tracking-wide">NUEVO DESPACHO</h2>
                  {agregados > 0 && (
                    <p className="text-xs text-green-400 font-mono flex items-center gap-1">
                      <CheckCircle size={10} />
                      {agregados} agregado{agregados !== 1 ? 's' : ''} · último: {ultimoAgregado}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={cerrarModal}
                className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--c-text-2)] hover:bg-slate-700/50 transition-all"
              >
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
                          activo
                            ? `${col.bg} ${col.border} ${col.text}`
                            : 'border-[var(--c-border-sub)] text-slate-500 hover:border-slate-600'
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

              {/* Número + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Número</label>
                  <input
                    type="text"
                    value={numero}
                    onChange={e => { setNumero(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleCrear()}
                    placeholder="DES-2024-001"
                    className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Alimentador + Subestación */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Alimentador</label>
                  <input
                    type="text"
                    value={alimentador}
                    onChange={e => setAlimentador(e.target.value)}
                    placeholder="Ej: AL-03"
                    className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Subestación</label>
                  <input
                    type="text"
                    value={subestacion}
                    onChange={e => setSubestacion(e.target.value)}
                    placeholder="Ej: SE-Norte"
                    className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">Dirección</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCrear()}
                  placeholder="Calle, ruta, coordenadas..."
                  className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
                  <AlertCircle size={12} />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleCrear}
                disabled={guardando || !numero.trim() || !planta}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-700 tracking-wider transition-all ${
                  !guardando && numero.trim() && planta
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
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="font-display font-700 text-lg text-[var(--c-text)] tracking-wide flex items-center gap-2">
            <Hash size={18} className="text-amber-400" />
            DESPACHOS REGISTRADOS
            <span className="font-mono text-xs text-slate-500 font-400">({despachos.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={cargar} className="btn-ghost p-2 rounded-lg flex-shrink-0">
              <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
            </button>
            <button
              onClick={abrirModal}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-700 tracking-wider"
            >
              <Plus size={14} />
              NUEVO
            </button>
          </div>
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
            <button
              onClick={abrirModal}
              className="mt-3 text-xs text-amber-400/70 hover:text-amber-400 font-mono underline underline-offset-2 transition-colors"
            >
              Agregar el primero
            </button>
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
                        className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-3 group hover:border-slate-600 transition-all"
                      >
                        {editId === d.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <input
                                type="text"
                                value={editNumero}
                                onChange={e => setEditNumero(e.target.value)}
                                className="input-solar rounded-lg px-3 py-1.5 text-sm"
                                placeholder="Número de despacho"
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
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-1.5 h-6 rounded-full ${col.dot} opacity-60 flex-shrink-0 mt-0.5`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-amber-400 text-sm font-600">{d.numero}</span>
                                  <span className="text-slate-500 text-xs">·</span>
                                  <span className="text-[var(--c-text)] text-sm truncate">{d.planta}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="font-mono text-xs text-slate-500">{d.fecha}</span>
                                </div>
                                {(d.alimentador || d.subestacion || d.direccion) && (
                                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    {d.alimentador && (
                                      <span className="font-mono text-xs text-slate-500">
                                        <span className="text-slate-600">Alim.</span> {d.alimentador}
                                      </span>
                                    )}
                                    {d.subestacion && (
                                      <span className="font-mono text-xs text-slate-500">
                                        <span className="text-slate-600">SE</span> {d.subestacion}
                                      </span>
                                    )}
                                    {d.direccion && (
                                      <span className="text-xs text-slate-500 truncate">{d.direccion}</span>
                                    )}
                                  </div>
                                )}
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
