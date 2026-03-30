'use client';
// src/components/GestionPlantas.tsx
import { useState, useEffect, useCallback } from 'react';
import { Planta, Despacho, AnyDesk, FichaPlanta, TipoPlanta, Cliente, CLIENTES } from '@/lib/types';
import { crearPlanta, obtenerPlantas, eliminarPlanta } from '@/lib/plantas';
import { crearDespacho, obtenerDespachos, eliminarDespacho, actualizarDespacho } from '@/lib/despachos';
import { crearAnyDesk, obtenerAnyDesks, eliminarAnyDesk, actualizarAnyDesk } from '@/lib/anydesk';
import { obtenerFichas, guardarFicha } from '@/lib/fichas';
import {
  Plus, Trash2, Loader2, Sun, Building2, RefreshCw, AlertCircle,
  Truck, Monitor, Hash, MapPin, Zap, Pencil, Check, X,
  Copy, ClipboardCheck, ChevronRight, Search, FileText, Phone,
  Save, CheckCircle, Wind, Droplets, Flame, Cpu, Settings, Plug
} from 'lucide-react';

const COLORES: Record<Cliente, { bg: string; border: string; text: string; dot: string }> = {
  'Carbon Free': { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  'Matrix':      { bg: 'bg-cyan-500/10',  border: 'border-cyan-500/30',  text: 'text-cyan-400',  dot: 'bg-cyan-400'  },
};

const TIPOS_PLANTA: { value: TipoPlanta; icon: React.ReactNode; color: string }[] = [
  { value: 'Fotovoltaica', icon: <Sun size={13} />,      color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  { value: 'Eólica',       icon: <Wind size={13} />,     color: 'text-sky-400   border-sky-500/40   bg-sky-500/10'   },
  { value: 'Hidráulica',   icon: <Droplets size={13} />, color: 'text-blue-400  border-blue-500/40  bg-blue-500/10'  },
  { value: 'Termosolar',   icon: <Flame size={13} />,    color: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
  { value: 'Otra',         icon: <Cpu size={13} />,      color: 'text-slate-400 border-slate-500/40 bg-slate-500/10' },
];

const FICHA_VACIA = (plantaNombre: string, cliente: Cliente): FichaPlanta => ({
  plantaNombre, cliente,
  tipoPlanta: undefined, fechaOperacion: '', codigoPMGD: '', numeroContrato: '', empresa: '',
  potenciaInstaladaDC: '', potenciaNominalAC: '', numInversores: '', numTrackers: '',
  numStrings: '', tecnologia: '',
  tensionAlimentador: '', capacidadAlimentador: '', tensionTrabajoMin: '', tensionTrabajoMax: '',
  limitacion: '', tipoLimitacion: '',
  contactoNombre: '', contactoTelefono: '', contactoDistribuidora: '',
  telefonoDistribuidora: '', contactoEmergencia: '',
  procedimientos: '', observaciones: '',
});

function CampoFicha({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm text-[var(--c-text)] font-500">{value}</span>
    </div>
  );
}

function SeccionFicha({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <span className="font-display font-600 text-xs tracking-widest text-slate-500">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pl-1">{children}</div>
    </div>
  );
}

function InputFicha({ label, value, onChange, placeholder, fullWidth = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; fullWidth?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? 'col-span-2' : ''}`}>
      <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="input-solar rounded-lg px-3 py-1.5 text-sm" />
    </div>
  );
}

function TextareaFicha({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1 col-span-2">
      <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="input-solar rounded-lg px-3 py-2 text-sm resize-none" />
    </div>
  );
}

export default function GestionPlantas({ soloLectura = false }: { soloLectura?: boolean }) {
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [anydesks, setAnydesks] = useState<AnyDesk[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [busqueda, setBusqueda] = useState('');

  // Modal
  const [plantaSeleccionada, setPlantaSeleccionada] = useState<Planta | null>(null);

  // Form nueva planta
  const [guardandoPlanta, setGuardandoPlanta] = useState(false);
  const [nombrePlanta, setNombrePlanta] = useState('');
  const [clientePlanta, setClientePlanta] = useState<Cliente>('Carbon Free');
  const [confirmDeletePlanta, setConfirmDeletePlanta] = useState<string | null>(null);

  // Despachos en modal
  const [formDespacho, setFormDespacho] = useState(false);
  const [despNumero, setDespNumero] = useState('');
  const [despAlimentador, setDespAlimentador] = useState('');
  const [despSubestacion, setDespSubestacion] = useState('');
  const [despDireccion, setDespDireccion] = useState('');
  const [guardandoDesp, setGuardandoDesp] = useState(false);
  const [confirmDeleteDesp, setConfirmDeleteDesp] = useState<string | null>(null);
  const [editDespId, setEditDespId] = useState<string | null>(null);
  const [editDespData, setEditDespData] = useState<Partial<Despacho>>({});
  const [copiadoDesp, setCopiadoDesp] = useState<string | null>(null);

  // AnyDesks en modal
  const [formAnyDesk, setFormAnyDesk] = useState(false);
  const [adNombre, setAdNombre] = useState('');
  const [adNumero, setAdNumero] = useState('');
  const [guardandoAd, setGuardandoAd] = useState(false);
  const [confirmDeleteAd, setConfirmDeleteAd] = useState<string | null>(null);
  const [editAdId, setEditAdId] = useState<string | null>(null);
  const [editAdData, setEditAdData] = useState({ nombre: '', numero: '' });
  const [copiadoAd, setCopiadoAd] = useState<string | null>(null);

  // Fichas técnicas
  const [fichas, setFichas] = useState<FichaPlanta[]>([]);
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [formFicha, setFormFicha] = useState<FichaPlanta | null>(null);
  const [guardandoFicha, setGuardandoFicha] = useState(false);
  const [guardadoFichaOk, setGuardadoFichaOk] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [plts, desps, ads, fichs] = await Promise.all([obtenerPlantas(), obtenerDespachos(), obtenerAnyDesks(), obtenerFichas()]);
      setPlantas(plts);
      setDespachos(desps);
      setAnydesks(ads);
      setFichas(fichs);
      // Actualizar planta seleccionada si está abierta
      if (plantaSeleccionada) {
        const updated = plts.find(p => p.id === plantaSeleccionada.id);
        if (updated) setPlantaSeleccionada(updated);
      }
    } catch {
      setError('Error al cargar datos');
    } finally {
      setCargando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirModal = (planta: Planta) => {
    setPlantaSeleccionada(planta);
    setFormDespacho(false);
    setFormAnyDesk(false);
    setEditDespId(null);
    setEditAdId(null);
    setConfirmDeleteDesp(null);
    setConfirmDeleteAd(null);
    setConfirmDeletePlanta(null);
  };

  const cerrarModal = () => {
    setPlantaSeleccionada(null);
    setFormDespacho(false);
    setFormAnyDesk(false);
  };

  // ── PLANTAS ──
  const handleCrearPlanta = async () => {
    if (!nombrePlanta.trim()) return;
    if (plantas.some(p => p.nombre.toLowerCase() === nombrePlanta.trim().toLowerCase())) {
      setError('Ya existe una planta con ese nombre'); return;
    }
    setGuardandoPlanta(true); setError('');
    try {
      await crearPlanta({ nombre: nombrePlanta.trim(), cliente: clientePlanta });
      setNombrePlanta('');
      await cargar();
    } catch { setError('Error al crear la planta'); }
    finally { setGuardandoPlanta(false); }
  };

  const handleEliminarPlanta = async (id: string) => {
    if (confirmDeletePlanta !== id) { setConfirmDeletePlanta(id); return; }
    try {
      await eliminarPlanta(id);
      setConfirmDeletePlanta(null);
      cerrarModal();
      await cargar();
    } catch { setError('Error al eliminar planta'); }
  };

  // ── DESPACHOS ──
  const handleCrearDespacho = async () => {
    if (!despNumero.trim() || !plantaSeleccionada) return;
    setGuardandoDesp(true);
    try {
      await crearDespacho({ planta: plantaSeleccionada.nombre, cliente: plantaSeleccionada.cliente, numero: despNumero.trim(), alimentador: despAlimentador.trim(), subestacion: despSubestacion.trim(), direccion: despDireccion.trim() });
      setDespNumero(''); setDespAlimentador(''); setDespSubestacion(''); setDespDireccion('');
      setFormDespacho(false);
      await cargar();
    } catch { setError('Error al crear despacho'); }
    finally { setGuardandoDesp(false); }
  };

  const handleEliminarDespacho = async (id: string) => {
    if (confirmDeleteDesp !== id) { setConfirmDeleteDesp(id); return; }
    try { await eliminarDespacho(id); setConfirmDeleteDesp(null); await cargar(); }
    catch { setError('Error al eliminar despacho'); }
  };

  const handleGuardarEditDespacho = async () => {
    if (!editDespId || !editDespData.numero?.trim()) return;
    try {
      await actualizarDespacho(editDespId, { numero: editDespData.numero!.trim(), alimentador: editDespData.alimentador?.trim() ?? '', subestacion: editDespData.subestacion?.trim() ?? '', direccion: editDespData.direccion?.trim() ?? '' });
      setEditDespId(null);
      await cargar();
    } catch { setError('Error al actualizar despacho'); }
  };

  const copiar = async (id: string, val: string, setCopied: (v: string | null) => void) => {
    try { await navigator.clipboard.writeText(val); } catch {
      const el = document.createElement('textarea'); el.value = val;
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  // ── ANYDESK ──
  const handleCrearAnyDesk = async () => {
    if (!adNombre.trim() || !adNumero.trim() || !plantaSeleccionada) return;
    setGuardandoAd(true);
    try {
      await crearAnyDesk({ planta: plantaSeleccionada.nombre, cliente: plantaSeleccionada.cliente, nombre: adNombre.trim(), numero: adNumero.trim() });
      setAdNombre(''); setAdNumero('');
      setFormAnyDesk(false);
      await cargar();
    } catch { setError('Error al crear AnyDesk'); }
    finally { setGuardandoAd(false); }
  };

  const handleEliminarAnyDesk = async (id: string) => {
    if (confirmDeleteAd !== id) { setConfirmDeleteAd(id); return; }
    try { await eliminarAnyDesk(id); setConfirmDeleteAd(null); await cargar(); }
    catch { setError('Error al eliminar AnyDesk'); }
  };

  const handleGuardarEditAnyDesk = async () => {
    if (!editAdId || !editAdData.nombre.trim() || !editAdData.numero.trim()) return;
    try {
      await actualizarAnyDesk(editAdId, { nombre: editAdData.nombre.trim(), numero: editAdData.numero.trim() });
      setEditAdId(null);
      await cargar();
    } catch { setError('Error al actualizar AnyDesk'); }
  };

  const despsDeSeleccionada = plantaSeleccionada ? despachos.filter(d => d.planta === plantaSeleccionada.nombre) : [];
  const adsDeSeleccionada   = plantaSeleccionada ? anydesks.filter(a => a.planta === plantaSeleccionada.nombre) : [];
  const fichaDeSeleccionada = plantaSeleccionada ? fichas.find(f => f.plantaNombre === plantaSeleccionada.nombre) ?? null : null;

  const handleGuardarFicha = async () => {
    if (!formFicha || !plantaSeleccionada) return;
    setGuardandoFicha(true);
    try {
      await guardarFicha({ ...formFicha, plantaNombre: plantaSeleccionada.nombre, cliente: plantaSeleccionada.cliente });
      setEditandoFicha(false);
      setGuardadoFichaOk(true);
      setTimeout(() => setGuardadoFichaOk(false), 2500);
      await cargar();
    } catch { setError('Error al guardar ficha'); }
    finally { setGuardandoFicha(false); }
  };

  const iniciarEditFicha = () => {
    if (!plantaSeleccionada) return;
    setFormFicha(fichaDeSeleccionada
      ? { ...fichaDeSeleccionada }
      : FICHA_VACIA(plantaSeleccionada.nombre, plantaSeleccionada.cliente));
    setEditandoFicha(true);
  };

  const q = busqueda.toLowerCase();
  const plantasFiltradas = busqueda
    ? plantas.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        despachos.some(d => d.planta === p.nombre && (d.numero.toLowerCase().includes(q) || d.alimentador?.toLowerCase().includes(q) || d.subestacion?.toLowerCase().includes(q))) ||
        anydesks.some(a => a.planta === p.nombre && (a.nombre.toLowerCase().includes(q) || a.numero.toLowerCase().includes(q)))
      )
    : plantas;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── FORM NUEVA PLANTA (admin) ── */}
      {!soloLectura && (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Building2 size={15} className="text-amber-400" />
            </div>
            <h2 className="font-display font-700 text-base text-[var(--c-text)] tracking-wide">AGREGAR PLANTA</h2>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {CLIENTES.map(c => {
                const col = COLORES[c];
                return (
                  <button key={c} type="button" onClick={() => setClientePlanta(c)}
                    className={`py-2.5 px-3 rounded-xl border-2 transition-all flex items-center gap-2 ${clientePlanta === c ? `${col.bg} ${col.border} ${col.text}` : 'border-[var(--c-border-sub)] text-slate-500 hover:border-slate-600'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${clientePlanta === c ? col.dot : 'bg-slate-700'}`} />
                    <span className="font-display font-600 text-sm">{c}</span>
                    {clientePlanta === c && <span className="ml-auto font-mono text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input type="text" value={nombrePlanta}
                onChange={e => { setNombrePlanta(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCrearPlanta()}
                placeholder="Nombre de la planta..."
                className="input-solar flex-1 rounded-xl px-4 py-2.5 text-sm"
              />
              <button onClick={handleCrearPlanta} disabled={guardandoPlanta || !nombrePlanta.trim()}
                className="btn-primary px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-display font-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardandoPlanta ? <Loader2 size={14} className="spin-slow" /> : <Plus size={14} />}
                <span className="hidden sm:inline">AGREGAR</span>
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5 mt-3">
              <AlertCircle size={14} />{error}
              <button onClick={() => setError('')} className="ml-auto"><X size={12} /></button>
            </div>
          )}
        </div>
      )}

      {/* ── HEADER + BUSCADOR ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-700 text-base text-[var(--c-text)] tracking-wide flex items-center gap-2">
            <Sun size={16} className="text-amber-400" />
            PLANTAS REGISTRADAS
            <span className="font-mono text-xs text-slate-500 font-400">({plantasFiltradas.length}{busqueda ? `/${plantas.length}` : ''})</span>
          </h2>
          <button onClick={cargar} className="btn-ghost p-2 rounded-lg">
            <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
          </button>
        </div>
        {plantas.length > 0 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Buscar planta, despacho, alimentador, AnyDesk..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {cargando && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="spin-slow text-amber-400" />
        </div>
      )}

      {!cargando && plantas.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-500 font-mono text-sm">No hay plantas registradas aún</p>
        </div>
      )}

      {!cargando && plantas.length > 0 && plantasFiltradas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 font-mono text-sm">Sin resultados para &quot;{busqueda}&quot;</p>
          <button onClick={() => setBusqueda('')} className="mt-2 text-xs text-amber-400/70 hover:text-amber-400 font-mono underline underline-offset-2 transition-colors">Limpiar búsqueda</button>
        </div>
      )}

      {/* ── LISTA DE PLANTAS POR CLIENTE ── */}
      {!cargando && CLIENTES.map(c => {
        const lista = plantasFiltradas.filter(p => p.cliente === c);
        if (lista.length === 0) return null;
        const col = COLORES[c];
        return (
          <div key={c} className="space-y-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${col.bg} border ${col.border}`}>
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className={`font-display font-700 text-sm tracking-widest ${col.text}`}>{c}</span>
              <span className={`ml-auto font-mono text-xs ${col.text} opacity-70`}>{lista.length} planta{lista.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
              {lista.map(planta => {
                const nDesps = despachos.filter(d => d.planta === planta.nombre).length;
                const nAds   = anydesks.filter(a => a.planta === planta.nombre).length;
                const tieneFicha = fichas.some(f => f.plantaNombre === planta.nombre);
                return (
                  <button key={planta.id} onClick={() => abrirModal(planta)}
                    className="w-full text-left bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl px-4 py-3 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1.5 h-8 rounded-full ${col.dot} opacity-60 flex-shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-[var(--c-text)] font-600 text-sm truncate">{planta.nombre}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 font-mono text-xs text-slate-500">
                              <Truck size={10} /> {nDesps}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-xs text-slate-500">
                              <Monitor size={10} /> {nAds}
                            </span>
                            {tieneFicha && (
                              <span className="flex items-center gap-1 font-mono text-xs text-purple-400/60">
                                <FileText size={10} /> ficha
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ══════════════════════════════════════════
          MODAL DETALLE PLANTA
      ══════════════════════════════════════════ */}
      {plantaSeleccionada && (() => {
        const p = plantaSeleccionada;
        const col = COLORES[p.cliente];
        const accentColor = p.cliente === 'Carbon Free' ? 'rgba(34,197,94,0.7)' : 'rgba(0,212,255,0.65)';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
          >
            <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Banda de color */}
              <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor} 40%, ${accentColor} 60%, transparent 100%)` }} />

              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-[var(--c-border-sub)] flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${col.bg} border ${col.border} flex items-center justify-center flex-shrink-0`}>
                      <Building2 size={18} className={col.text} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-700 text-base text-[var(--c-text)] tracking-wide truncate">{p.nombre}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                        <span className={`font-mono text-xs ${col.text}`}>{p.cliente}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!soloLectura && (
                      confirmDeletePlanta === p.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleEliminarPlanta(p.id!)} className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-1">
                            <Check size={11} /> Eliminar planta
                          </button>
                          <button onClick={() => setConfirmDeletePlanta(null)} className="p-1.5 rounded-lg border border-[var(--c-border-sub)] text-slate-500">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeletePlanta(p.id!)} className="p-2 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Eliminar planta">
                          <Trash2 size={15} />
                        </button>
                      )
                    )}
                    <button onClick={cerrarModal} className="p-2 rounded-xl text-slate-500 hover:text-[var(--c-text-2)] hover:bg-[var(--c-inner)] transition-all">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenido scrolleable */}
              <div className="overflow-y-auto flex-1 divide-y divide-[var(--c-border-sub)]">

                {/* ── DESPACHOS ── */}
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-amber-400" />
                      <span className="font-display font-600 text-sm tracking-widest text-[var(--c-text)]">DESPACHOS</span>
                      <span className="font-mono text-xs text-slate-500">({despsDeSeleccionada.length})</span>
                    </div>
                    {!soloLectura && !formDespacho && (
                      <button onClick={() => { setFormDespacho(true); setDespNumero(''); setDespAlimentador(''); setDespSubestacion(''); setDespDireccion(''); }}
                        className="flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-amber-400 transition-colors border border-[var(--c-border-sub)] hover:border-amber-400/40 rounded-lg px-2.5 py-1.5"
                      >
                        <Plus size={11} /> Agregar
                      </button>
                    )}
                  </div>

                  {/* Form nuevo despacho */}
                  {!soloLectura && formDespacho && (
                    <div className="bg-[var(--c-inner)] border border-amber-500/20 rounded-xl p-3 mb-3 space-y-2">
                      <input type="text" placeholder="Número de despacho *" value={despNumero} onChange={e => setDespNumero(e.target.value)}
                        className="input-solar w-full rounded-lg px-3 py-2 text-sm font-mono" autoFocus />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Alimentador" value={despAlimentador} onChange={e => setDespAlimentador(e.target.value)} className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
                        <input type="text" placeholder="Subestación" value={despSubestacion} onChange={e => setDespSubestacion(e.target.value)} className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <input type="text" placeholder="Dirección" value={despDireccion} onChange={e => setDespDireccion(e.target.value)} className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleCrearDespacho} disabled={guardandoDesp || !despNumero.trim()}
                          className="flex-1 py-2 rounded-lg btn-primary flex items-center justify-center gap-1.5 text-xs font-display font-700 disabled:opacity-50"
                        >
                          {guardandoDesp ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} GUARDAR
                        </button>
                        <button onClick={() => setFormDespacho(false)} className="px-3 py-2 rounded-lg border border-[var(--c-border)] text-slate-400 text-xs font-mono">Cancelar</button>
                      </div>
                    </div>
                  )}

                  {despsDeSeleccionada.length === 0 && !formDespacho && (
                    <p className="text-xs font-mono text-slate-600 py-1">Sin despachos registrados</p>
                  )}

                  <div className="space-y-2">
                    {despsDeSeleccionada.map(d => (
                      <div key={d.id} className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-3 py-2.5 group">
                        {editDespId === d.id ? (
                          <div className="space-y-2">
                            <input type="text" value={editDespData.numero ?? ''} onChange={e => setEditDespData(v => ({ ...v, numero: e.target.value }))} placeholder="Número" className="input-solar w-full rounded-lg px-3 py-1.5 text-sm font-mono" autoFocus />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" value={editDespData.alimentador ?? ''} onChange={e => setEditDespData(v => ({ ...v, alimentador: e.target.value }))} placeholder="Alimentador" className="input-solar w-full rounded-lg px-3 py-1.5 text-sm" />
                              <input type="text" value={editDespData.subestacion ?? ''} onChange={e => setEditDespData(v => ({ ...v, subestacion: e.target.value }))} placeholder="Subestación" className="input-solar w-full rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                            <input type="text" value={editDespData.direccion ?? ''} onChange={e => setEditDespData(v => ({ ...v, direccion: e.target.value }))} placeholder="Dirección" className="input-solar w-full rounded-lg px-3 py-1.5 text-sm" />
                            <div className="flex gap-2 pt-1">
                              <button onClick={handleGuardarEditDespacho} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-mono"><Check size={11} /> Guardar</button>
                              <button onClick={() => setEditDespId(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--c-border-sub)] text-slate-400 text-xs font-mono"><X size={11} /> Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-amber-400 text-sm font-600">{d.numero}</span>
                                {d.alimentador && <span className="flex items-center gap-1 text-xs font-mono text-slate-500"><Zap size={10} className="text-amber-400/60" />{d.alimentador}</span>}
                                {d.subestacion && <span className="flex items-center gap-1 text-xs font-mono text-slate-500"><Hash size={10} />{d.subestacion}</span>}
                              </div>
                              {d.direccion && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={10} />{d.direccion}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => copiar(d.id!, d.numero, setCopiadoDesp)}
                                className={`p-1.5 rounded-lg transition-all ${copiadoDesp === d.id ? 'text-green-400 bg-green-400/10' : 'text-slate-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
                              >
                                {copiadoDesp === d.id ? <ClipboardCheck size={12} /> : <Copy size={12} />}
                              </button>
                              {!soloLectura && (
                                <>
                                  <button onClick={() => { setEditDespId(d.id!); setEditDespData({ numero: d.numero, alimentador: d.alimentador ?? '', subestacion: d.subestacion ?? '', direccion: d.direccion ?? '' }); }}
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                                  ><Pencil size={12} /></button>
                                  <button onClick={() => handleEliminarDespacho(d.id!)}
                                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs ${confirmDeleteDesp === d.id ? 'bg-red-500/20 border border-red-500/40 text-red-400 opacity-100' : 'text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100'}`}
                                  >
                                    <Trash2 size={12} />{confirmDeleteDesp === d.id && <span className="font-mono">¿Eliminar?</span>}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── ANYDESK ── */}
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Monitor size={14} className="text-cyan-400" />
                      <span className="font-display font-600 text-sm tracking-widest text-[var(--c-text)]">ANYDESK</span>
                      <span className="font-mono text-xs text-slate-500">({adsDeSeleccionada.length})</span>
                    </div>
                    {!soloLectura && !formAnyDesk && (
                      <button onClick={() => { setFormAnyDesk(true); setAdNombre(''); setAdNumero(''); }}
                        className="flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-cyan-400 transition-colors border border-[var(--c-border-sub)] hover:border-cyan-400/40 rounded-lg px-2.5 py-1.5"
                      >
                        <Plus size={11} /> Agregar
                      </button>
                    )}
                  </div>

                  {/* Form nuevo anydesk */}
                  {!soloLectura && formAnyDesk && (
                    <div className="bg-[var(--c-inner)] border border-cyan-500/20 rounded-xl p-3 mb-3 space-y-2">
                      <input type="text" placeholder="Nombre (ej: Inversor 1, PC Sala...)" value={adNombre} onChange={e => setAdNombre(e.target.value)} className="input-solar w-full rounded-lg px-3 py-2 text-sm" autoFocus />
                      <input type="text" placeholder="Número AnyDesk" value={adNumero} onChange={e => setAdNumero(e.target.value)} className="input-solar w-full rounded-lg px-3 py-2 text-sm font-mono" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleCrearAnyDesk} disabled={guardandoAd || !adNombre.trim() || !adNumero.trim()}
                          className="flex-1 py-2 rounded-lg btn-primary flex items-center justify-center gap-1.5 text-xs font-display font-700 disabled:opacity-50"
                        >
                          {guardandoAd ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} GUARDAR
                        </button>
                        <button onClick={() => setFormAnyDesk(false)} className="px-3 py-2 rounded-lg border border-[var(--c-border)] text-slate-400 text-xs font-mono">Cancelar</button>
                      </div>
                    </div>
                  )}

                  {adsDeSeleccionada.length === 0 && !formAnyDesk && (
                    <p className="text-xs font-mono text-slate-600 py-1">Sin accesos AnyDesk registrados</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {adsDeSeleccionada.map(a => (
                      <div key={a.id} className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-3 py-2.5 group">
                        {editAdId === a.id ? (
                          <div className="space-y-2">
                            <input type="text" value={editAdData.nombre} onChange={e => setEditAdData(v => ({ ...v, nombre: e.target.value }))} placeholder="Nombre" className="input-solar w-full rounded-lg px-3 py-1.5 text-sm" autoFocus />
                            <input type="text" value={editAdData.numero} onChange={e => setEditAdData(v => ({ ...v, numero: e.target.value }))} placeholder="Número" className="input-solar w-full rounded-lg px-3 py-1.5 text-sm font-mono" />
                            <div className="flex gap-2 pt-1">
                              <button onClick={handleGuardarEditAnyDesk} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-mono"><Check size={11} /> Guardar</button>
                              <button onClick={() => setEditAdId(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--c-border-sub)] text-slate-400 text-xs font-mono"><X size={11} /> Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[var(--c-text)] text-xs font-500 truncate">{a.nombre}</p>
                              <p className="font-mono text-cyan-400 text-sm tracking-widest">{a.numero}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => copiar(a.id!, a.numero, setCopiadoAd)}
                                className={`p-1.5 rounded-lg transition-all ${copiadoAd === a.id ? 'text-green-400 bg-green-400/10' : 'text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100'}`}
                              >
                                {copiadoAd === a.id ? <ClipboardCheck size={12} /> : <Copy size={12} />}
                              </button>
                              {!soloLectura && (
                                <>
                                  <button onClick={() => { setEditAdId(a.id!); setEditAdData({ nombre: a.nombre, numero: a.numero }); }}
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                                  ><Pencil size={12} /></button>
                                  <button onClick={() => handleEliminarAnyDesk(a.id!)}
                                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs ${confirmDeleteAd === a.id ? 'bg-red-500/20 border border-red-500/40 text-red-400 opacity-100' : 'text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100'}`}
                                  >
                                    <Trash2 size={12} />{confirmDeleteAd === a.id && <span className="font-mono">¿Eliminar?</span>}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── FICHA TÉCNICA ── */}
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-purple-400" />
                      <span className="font-display font-600 text-sm tracking-widest text-[var(--c-text)]">FICHA TÉCNICA</span>
                      {fichaDeSeleccionada && (
                        <span className="font-mono text-xs text-purple-400/70 bg-purple-500/10 border border-purple-500/20 rounded px-1.5 py-0.5">
                          {fichaDeSeleccionada.tipoPlanta ?? 'Registrada'}
                        </span>
                      )}
                    </div>
                    {!soloLectura && !editandoFicha && (
                      <button onClick={iniciarEditFicha}
                        className="flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-purple-400 transition-colors border border-[var(--c-border-sub)] hover:border-purple-400/40 rounded-lg px-2.5 py-1.5"
                      >
                        <Pencil size={11} /> {fichaDeSeleccionada ? 'Editar' : 'Completar'}
                      </button>
                    )}
                    {guardadoFichaOk && (
                      <span className="flex items-center gap-1 text-xs font-mono text-green-400">
                        <CheckCircle size={12} /> Guardado
                      </span>
                    )}
                  </div>

                  {/* MODO EDICIÓN */}
                  {editandoFicha && formFicha && (
                    <div className="space-y-5">

                      {/* Tipo planta */}
                      <div className="space-y-1.5">
                        <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">Tipo de planta</label>
                        <div className="flex flex-wrap gap-2">
                          {TIPOS_PLANTA.map(t => (
                            <button key={t.value} type="button"
                              onClick={() => setFormFicha(f => f ? { ...f, tipoPlanta: t.value } : f)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${formFicha.tipoPlanta === t.value ? t.color : 'border-[var(--c-border-sub)] text-slate-500 hover:border-slate-500'}`}
                            >
                              {t.icon} {t.value}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <InputFicha label="Fecha operación" value={formFicha.fechaOperacion ?? ''} onChange={v => setFormFicha(f => f ? { ...f, fechaOperacion: v } : f)} placeholder="dd/mm/yyyy" />
                        <InputFicha label="Código PMGD" value={formFicha.codigoPMGD ?? ''} onChange={v => setFormFicha(f => f ? { ...f, codigoPMGD: v } : f)} />
                        <InputFicha label="N° Contrato" value={formFicha.numeroContrato ?? ''} onChange={v => setFormFicha(f => f ? { ...f, numeroContrato: v } : f)} />
                        <InputFicha label="Distribuidora" value={formFicha.empresa ?? ''} onChange={v => setFormFicha(f => f ? { ...f, empresa: v } : f)} />
                      </div>

                      <div className="border-t border-[var(--c-border-sub)] pt-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap size={12} className="text-amber-400" />
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Generación</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InputFicha label="Potencia DC (kWp)" value={formFicha.potenciaInstaladaDC ?? ''} onChange={v => setFormFicha(f => f ? { ...f, potenciaInstaladaDC: v } : f)} />
                          <InputFicha label="Potencia AC (kW)" value={formFicha.potenciaNominalAC ?? ''} onChange={v => setFormFicha(f => f ? { ...f, potenciaNominalAC: v } : f)} />
                          <InputFicha label="N° Inversores" value={formFicha.numInversores ?? ''} onChange={v => setFormFicha(f => f ? { ...f, numInversores: v } : f)} />
                          <InputFicha label="N° Trackers" value={formFicha.numTrackers ?? ''} onChange={v => setFormFicha(f => f ? { ...f, numTrackers: v } : f)} />
                          <InputFicha label="N° Strings" value={formFicha.numStrings ?? ''} onChange={v => setFormFicha(f => f ? { ...f, numStrings: v } : f)} />
                          <InputFicha label="Tecnología" value={formFicha.tecnologia ?? ''} onChange={v => setFormFicha(f => f ? { ...f, tecnologia: v } : f)} />
                        </div>
                      </div>

                      <div className="border-t border-[var(--c-border-sub)] pt-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Plug size={12} className="text-sky-400" />
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Conexión eléctrica</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InputFicha label="Tensión alimentador (kV)" value={formFicha.tensionAlimentador ?? ''} onChange={v => setFormFicha(f => f ? { ...f, tensionAlimentador: v } : f)} />
                          <InputFicha label="Capacidad alim. (MVA)" value={formFicha.capacidadAlimentador ?? ''} onChange={v => setFormFicha(f => f ? { ...f, capacidadAlimentador: v } : f)} />
                          <InputFicha label="Tensión mín. (kV)" value={formFicha.tensionTrabajoMin ?? ''} onChange={v => setFormFicha(f => f ? { ...f, tensionTrabajoMin: v } : f)} />
                          <InputFicha label="Tensión máx. (kV)" value={formFicha.tensionTrabajoMax ?? ''} onChange={v => setFormFicha(f => f ? { ...f, tensionTrabajoMax: v } : f)} />
                          <InputFicha label="Limitación (kW)" value={formFicha.limitacion ?? ''} onChange={v => setFormFicha(f => f ? { ...f, limitacion: v } : f)} />
                          <InputFicha label="Tipo limitación" value={formFicha.tipoLimitacion ?? ''} onChange={v => setFormFicha(f => f ? { ...f, tipoLimitacion: v } : f)} />
                        </div>
                      </div>

                      <div className="border-t border-[var(--c-border-sub)] pt-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Phone size={12} className="text-green-400" />
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Contactos</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InputFicha label="Contacto nombre" value={formFicha.contactoNombre ?? ''} onChange={v => setFormFicha(f => f ? { ...f, contactoNombre: v } : f)} />
                          <InputFicha label="Contacto teléfono" value={formFicha.contactoTelefono ?? ''} onChange={v => setFormFicha(f => f ? { ...f, contactoTelefono: v } : f)} />
                          <InputFicha label="Contacto distribuidora" value={formFicha.contactoDistribuidora ?? ''} onChange={v => setFormFicha(f => f ? { ...f, contactoDistribuidora: v } : f)} />
                          <InputFicha label="Tel. distribuidora" value={formFicha.telefonoDistribuidora ?? ''} onChange={v => setFormFicha(f => f ? { ...f, telefonoDistribuidora: v } : f)} />
                          <InputFicha label="Contacto emergencia" value={formFicha.contactoEmergencia ?? ''} onChange={v => setFormFicha(f => f ? { ...f, contactoEmergencia: v } : f)} fullWidth />
                        </div>
                      </div>

                      <div className="border-t border-[var(--c-border-sub)] pt-4 space-y-3">
                        <TextareaFicha label="Procedimientos" value={formFicha.procedimientos ?? ''} onChange={v => setFormFicha(f => f ? { ...f, procedimientos: v } : f)} />
                        <TextareaFicha label="Observaciones" value={formFicha.observaciones ?? ''} onChange={v => setFormFicha(f => f ? { ...f, observaciones: v } : f)} />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button onClick={handleGuardarFicha} disabled={guardandoFicha}
                          className="flex-1 py-2.5 rounded-xl btn-primary flex items-center justify-center gap-2 text-sm font-display font-700 disabled:opacity-50"
                        >
                          {guardandoFicha ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} GUARDAR FICHA
                        </button>
                        <button onClick={() => setEditandoFicha(false)}
                          className="px-4 py-2.5 rounded-xl border border-[var(--c-border)] text-slate-400 text-sm font-mono"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MODO VISTA */}
                  {!editandoFicha && fichaDeSeleccionada && (
                    <div className="space-y-5">

                      {/* Tipo */}
                      {fichaDeSeleccionada.tipoPlanta && (() => {
                        const t = TIPOS_PLANTA.find(t => t.value === fichaDeSeleccionada.tipoPlanta);
                        return t ? (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${t.color}`}>
                            {t.icon} {t.value}
                          </div>
                        ) : null;
                      })()}

                      <SeccionFicha icon={<Settings size={12} />} title="IDENTIFICACIÓN">
                        <CampoFicha label="Fecha operación" value={fichaDeSeleccionada.fechaOperacion} />
                        <CampoFicha label="Código PMGD" value={fichaDeSeleccionada.codigoPMGD} />
                        <CampoFicha label="N° Contrato" value={fichaDeSeleccionada.numeroContrato} />
                        <CampoFicha label="Distribuidora" value={fichaDeSeleccionada.empresa} />
                      </SeccionFicha>

                      <SeccionFicha icon={<Zap size={12} />} title="GENERACIÓN">
                        <CampoFicha label="Potencia DC" value={fichaDeSeleccionada.potenciaInstaladaDC ? `${fichaDeSeleccionada.potenciaInstaladaDC} kWp` : undefined} />
                        <CampoFicha label="Potencia AC" value={fichaDeSeleccionada.potenciaNominalAC ? `${fichaDeSeleccionada.potenciaNominalAC} kW` : undefined} />
                        <CampoFicha label="Inversores" value={fichaDeSeleccionada.numInversores} />
                        <CampoFicha label="Trackers" value={fichaDeSeleccionada.numTrackers} />
                        <CampoFicha label="Strings" value={fichaDeSeleccionada.numStrings} />
                        <CampoFicha label="Tecnología" value={fichaDeSeleccionada.tecnologia} />
                      </SeccionFicha>

                      <SeccionFicha icon={<Plug size={12} />} title="CONEXIÓN ELÉCTRICA">
                        <CampoFicha label="Tensión alimentador" value={fichaDeSeleccionada.tensionAlimentador ? `${fichaDeSeleccionada.tensionAlimentador} kV` : undefined} />
                        <CampoFicha label="Capacidad alim." value={fichaDeSeleccionada.capacidadAlimentador ? `${fichaDeSeleccionada.capacidadAlimentador} MVA` : undefined} />
                        <CampoFicha label="Tensión mín." value={fichaDeSeleccionada.tensionTrabajoMin ? `${fichaDeSeleccionada.tensionTrabajoMin} kV` : undefined} />
                        <CampoFicha label="Tensión máx." value={fichaDeSeleccionada.tensionTrabajoMax ? `${fichaDeSeleccionada.tensionTrabajoMax} kV` : undefined} />
                        <CampoFicha label="Limitación" value={fichaDeSeleccionada.limitacion ? `${fichaDeSeleccionada.limitacion} kW` : undefined} />
                        <CampoFicha label="Tipo limitación" value={fichaDeSeleccionada.tipoLimitacion} />
                      </SeccionFicha>

                      <SeccionFicha icon={<Phone size={12} />} title="CONTACTOS">
                        <CampoFicha label="Nombre" value={fichaDeSeleccionada.contactoNombre} />
                        <CampoFicha label="Teléfono" value={fichaDeSeleccionada.contactoTelefono} />
                        <CampoFicha label="Distribuidora" value={fichaDeSeleccionada.contactoDistribuidora} />
                        <CampoFicha label="Tel. distribuidora" value={fichaDeSeleccionada.telefonoDistribuidora} />
                        <CampoFicha label="Emergencia" value={fichaDeSeleccionada.contactoEmergencia} />
                      </SeccionFicha>

                      {fichaDeSeleccionada.procedimientos && (
                        <div className="space-y-1.5">
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Procedimientos</span>
                          <p className="text-sm text-[var(--c-text)] whitespace-pre-wrap leading-relaxed">{fichaDeSeleccionada.procedimientos}</p>
                        </div>
                      )}

                      {fichaDeSeleccionada.observaciones && (
                        <div className="space-y-1.5">
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Observaciones</span>
                          <p className="text-sm text-[var(--c-text)] whitespace-pre-wrap leading-relaxed">{fichaDeSeleccionada.observaciones}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sin ficha */}
                  {!editandoFicha && !fichaDeSeleccionada && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <FileText size={24} className="text-slate-700" />
                      <p className="font-mono text-xs text-slate-600 text-center">
                        Sin ficha técnica registrada
                        {!soloLectura && <span className="block text-slate-500 mt-0.5">Presiona &quot;Completar&quot; para agregarla</span>}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
