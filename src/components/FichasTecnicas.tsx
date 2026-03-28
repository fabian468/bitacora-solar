'use client';
// src/components/FichasTecnicas.tsx
import { useState, useEffect, useCallback } from 'react';
import { Planta, FichaPlanta, TipoPlanta, Cliente, CLIENTES } from '@/lib/types';
import { obtenerPlantas } from '@/lib/plantas';
import { obtenerFichas, guardarFicha } from '@/lib/fichas';
import {
  Building2, Loader2, RefreshCw, Search, X, Pencil, Save,
  Zap, Phone, FileText, ChevronRight, CheckCircle,
  AlertTriangle, Settings, Plug, Wind, Sun, Droplets, Flame, Cpu
} from 'lucide-react';

const COLORES: Record<Cliente, { bg: string; border: string; text: string; dot: string }> = {
  'Carbon Free': { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  'Matrix':      { bg: 'bg-cyan-500/10',  border: 'border-cyan-500/30',  text: 'text-cyan-400',  dot: 'bg-cyan-400'  },
};

const TIPOS_PLANTA: { value: TipoPlanta; icon: React.ReactNode; color: string }[] = [
  { value: 'Fotovoltaica', icon: <Sun size={14} />,      color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  { value: 'Eólica',       icon: <Wind size={14} />,     color: 'text-sky-400   border-sky-500/40   bg-sky-500/10'   },
  { value: 'Hidráulica',   icon: <Droplets size={14} />, color: 'text-blue-400  border-blue-500/40  bg-blue-500/10'  },
  { value: 'Termosolar',   icon: <Flame size={14} />,    color: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
  { value: 'Otra',         icon: <Cpu size={14} />,      color: 'text-slate-400 border-slate-500/40 bg-slate-500/10' },
];

const TECNOLOGIAS = ['Monocristalino', 'Policristalino', 'Bifacial', 'CdTe', 'Otro'];

function Campo({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm text-[var(--c-text)] font-500">{value}</span>
    </div>
  );
}

function Seccion({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <span className="font-display font-600 text-xs tracking-widest text-slate-400">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pl-1">
        {children}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, mono = false, fullWidth = false }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? 'col-span-2' : ''}`}>
      <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className={`input-solar rounded-lg px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1 col-span-2">
      <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        rows={3}
        className="input-solar rounded-lg px-3 py-2 text-sm resize-none"
      />
    </div>
  );
}

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

function TipoPlantaIcon({ tipo }: { tipo?: TipoPlanta }) {
  const t = TIPOS_PLANTA.find(t => t.value === tipo);
  if (!t) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${t.color}`}>
      {t.icon} {t.value}
    </span>
  );
}

export default function FichasTecnicas({ soloLectura = false }: { soloLectura?: boolean }) {
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [fichas, setFichas] = useState<FichaPlanta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [plantaSeleccionada, setPlantaSeleccionada] = useState<Planta | null>(null);
  const [ficha, setFicha] = useState<FichaPlanta | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FichaPlanta | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [plts, fichs] = await Promise.all([obtenerPlantas(), obtenerFichas()]);
      setPlantas(plts);
      setFichas(fichs);
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirModal = (planta: Planta) => {
    setPlantaSeleccionada(planta);
    const f = fichas.find(f => f.plantaNombre === planta.nombre && f.cliente === planta.cliente)
      ?? FICHA_VACIA(planta.nombre, planta.cliente);
    setFicha(f);
    setEditando(false);
    setGuardadoOk(false);
  };

  const cerrarModal = () => {
    setPlantaSeleccionada(null);
    setFicha(null);
    setEditando(false);
    setForm(null);
  };

  const iniciarEdicion = () => { setForm({ ...ficha! }); setEditando(true); };
  const cancelarEdicion = () => { setEditando(false); setForm(null); };

  const handleGuardar = async () => {
    if (!form) return;
    setGuardando(true);
    try {
      await guardarFicha(form);
      setFicha(form);
      setEditando(false);
      setForm(null);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
      await cargar();
    } catch { /* silencioso */ }
    finally { setGuardando(false); }
  };

  const set = (key: keyof FichaPlanta) => (v: string) => setForm(f => f ? { ...f, [key]: v } : f);

  const tieneFicha = (planta: Planta) =>
    fichas.some(f => f.plantaNombre === planta.nombre && f.cliente === planta.cliente);

  const q = busqueda.toLowerCase();
  const plantasFiltradas = busqueda
    ? plantas.filter(p => p.nombre.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q))
    : plantas;

  const fichaDatos = editando ? form : ficha;
  const esFotovoltaica = fichaDatos?.tipoPlanta === 'Fotovoltaica' || !fichaDatos?.tipoPlanta;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header + buscador */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-700 text-base text-[var(--c-text)] tracking-wide flex items-center gap-2">
            <FileText size={16} className="text-amber-400" />
            FICHAS TÉCNICAS
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
              placeholder="Buscar planta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="input-solar w-full rounded-xl pl-9 pr-9 py-2.5 text-sm"
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
          <p className="text-slate-500 font-mono text-sm">No hay plantas registradas</p>
          <p className="text-slate-600 text-xs mt-1">Crea plantas en la pestaña PLANTAS primero</p>
        </div>
      )}

      {!cargando && plantas.length > 0 && plantasFiltradas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 font-mono text-sm">Sin resultados para &quot;{busqueda}&quot;</p>
        </div>
      )}

      {/* Lista */}
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
                const tiene = tieneFicha(planta);
                const f = fichas.find(f => f.plantaNombre === planta.nombre);
                const tipo = TIPOS_PLANTA.find(t => t.value === f?.tipoPlanta);
                return (
                  <button key={planta.id} onClick={() => abrirModal(planta)}
                    className="w-full text-left bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl px-4 py-3 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1.5 h-8 rounded-full ${col.dot} opacity-60 flex-shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-[var(--c-text)] font-600 text-sm truncate">{planta.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {tipo ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-mono ${tipo.color.split(' ')[0]}`}>
                                {tipo.icon} {tipo.value}
                              </span>
                            ) : (
                              <span className={`text-xs font-mono ${tiene ? 'text-green-400' : 'text-slate-600'}`}>
                                {tiene ? '● Ficha completa' : '○ Sin ficha'}
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

      {/* ══════════════════════════════════════
          MODAL FICHA
      ══════════════════════════════════════ */}
      {plantaSeleccionada && fichaDatos && (() => {
        const p = plantaSeleccionada;
        const col = COLORES[p.cliente];
        const accentColor = p.cliente === 'Carbon Free' ? 'rgba(34,197,94,0.7)' : 'rgba(0,212,255,0.65)';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
          >
            <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

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
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                          <span className={`font-mono text-xs ${col.text}`}>{p.cliente}</span>
                        </div>
                        {fichaDatos.tipoPlanta && <TipoPlantaIcon tipo={fichaDatos.tipoPlanta} />}
                        {guardadoOk && (
                          <span className="flex items-center gap-1 text-xs font-mono text-green-400">
                            <CheckCircle size={11} /> Guardado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!soloLectura && !editando && (
                      <button onClick={iniciarEdicion}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--c-border)] text-slate-400 hover:text-amber-400 hover:border-amber-400/40 text-xs font-mono transition-all"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    )}
                    {editando && (
                      <>
                        <button onClick={cancelarEdicion} className="px-3 py-1.5 rounded-xl border border-[var(--c-border)] text-slate-400 text-xs font-mono">Cancelar</button>
                        <button onClick={handleGuardar} disabled={guardando}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-primary text-xs font-display font-700 tracking-wider disabled:opacity-60"
                        >
                          {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} GUARDAR
                        </button>
                      </>
                    )}
                    <button onClick={cerrarModal} className="p-2 rounded-xl text-slate-500 hover:text-[var(--c-text-2)] hover:bg-[var(--c-inner)] transition-all">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenido scrolleable */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

                {/* ── IDENTIFICACIÓN ── */}
                {editando ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-amber-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">IDENTIFICACIÓN</span>
                    </div>

                    {/* Tipo de planta */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">Tipo de planta</label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {TIPOS_PLANTA.map(t => (
                          <button key={t.value} type="button"
                            onClick={() => setForm(f => f ? { ...f, tipoPlanta: t.value } : f)}
                            className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border-2 transition-all text-xs font-mono ${
                              form?.tipoPlanta === t.value
                                ? t.color
                                : 'border-[var(--c-border-sub)] text-slate-500 hover:border-slate-500'
                            }`}
                          >
                            {t.icon} {t.value}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Fecha entrada operación" value={form?.fechaOperacion ?? ''} onChange={set('fechaOperacion')} placeholder="ej: 2022-03-15" />
                      <InputField label="Empresa distribuidora" value={form?.empresa ?? ''} onChange={set('empresa')} placeholder="ej: ENEL, CGE..." />
                      <InputField label="Código PMGD" value={form?.codigoPMGD ?? ''} onChange={set('codigoPMGD')} placeholder="ej: PMGD-001" mono />
                      <InputField label="N° contrato" value={form?.numeroContrato ?? ''} onChange={set('numeroContrato')} placeholder="ej: C-2022-045" mono />
                    </div>
                  </div>
                ) : (
                  <Seccion icon={<FileText size={13} />} title="IDENTIFICACIÓN">
                    <Campo label="En operación desde" value={fichaDatos.fechaOperacion} />
                    <Campo label="Distribuidora" value={fichaDatos.empresa} />
                    <Campo label="Código PMGD" value={fichaDatos.codigoPMGD} />
                    <Campo label="N° contrato" value={fichaDatos.numeroContrato} />
                  </Seccion>
                )}

                <div className="border-t border-[var(--c-border-sub)]" />

                {/* ── GENERACIÓN ── */}
                {editando ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={13} className="text-amber-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">GENERACIÓN</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Potencia instalada DC" value={form?.potenciaInstaladaDC ?? ''} onChange={set('potenciaInstaladaDC')} placeholder="ej: 5000 kWp" mono />
                      <InputField label="Potencia nominal AC" value={form?.potenciaNominalAC ?? ''} onChange={set('potenciaNominalAC')} placeholder="ej: 4500 kW" mono />
                      <InputField label="N° inversores" value={form?.numInversores ?? ''} onChange={set('numInversores')} placeholder="ej: 10" mono />
                      <InputField label="N° trackers" value={form?.numTrackers ?? ''} onChange={set('numTrackers')} placeholder="ej: 48" mono />
                      {esFotovoltaica && (
                        <>
                          <InputField label="N° strings" value={form?.numStrings ?? ''} onChange={set('numStrings')} placeholder="ej: 240" mono />
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-xs text-slate-500 uppercase tracking-widest">Tecnología</label>
                            <select value={form?.tecnologia ?? ''} onChange={e => set('tecnologia')(e.target.value)} className="input-solar rounded-lg px-3 py-2 text-sm">
                              <option value="">— Seleccionar —</option>
                              {TECNOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <Seccion icon={<Zap size={13} />} title="GENERACIÓN">
                    <Campo label="Potencia DC" value={fichaDatos.potenciaInstaladaDC} />
                    <Campo label="Potencia AC" value={fichaDatos.potenciaNominalAC} />
                    <Campo label="N° inversores" value={fichaDatos.numInversores} />
                    <Campo label="N° trackers" value={fichaDatos.numTrackers} />
                    {esFotovoltaica && (
                      <>
                        <Campo label="N° strings" value={fichaDatos.numStrings} />
                        <Campo label="Tecnología" value={fichaDatos.tecnologia} />
                      </>
                    )}
                  </Seccion>
                )}

                <div className="border-t border-[var(--c-border-sub)]" />

                {/* ── CONEXIÓN ELÉCTRICA ── */}
                {editando ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Plug size={13} className="text-cyan-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">CONEXIÓN ELÉCTRICA</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Tensión nominal alimentador" value={form?.tensionAlimentador ?? ''} onChange={set('tensionAlimentador')} placeholder="ej: 23 kV" mono />
                      <InputField label="Capacidad alimentador" value={form?.capacidadAlimentador ?? ''} onChange={set('capacidadAlimentador')} placeholder="ej: 10 MVA" mono />
                      <InputField label="Tensión mínima de trabajo" value={form?.tensionTrabajoMin ?? ''} onChange={set('tensionTrabajoMin')} placeholder="ej: 21.5 kV" mono />
                      <InputField label="Tensión máxima de trabajo" value={form?.tensionTrabajoMax ?? ''} onChange={set('tensionTrabajoMax')} placeholder="ej: 24.5 kV" mono />
                      <InputField label="Limitación de potencia" value={form?.limitacion ?? ''} onChange={set('limitacion')} placeholder="ej: 3500 kW" mono />
                      <InputField label="Tipo de limitación" value={form?.tipoLimitacion ?? ''} onChange={set('tipoLimitacion')} placeholder="ej: Por despacho" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Plug size={13} className="text-cyan-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">CONEXIÓN ELÉCTRICA</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pl-1">
                      <Campo label="Tensión nominal" value={fichaDatos.tensionAlimentador} />
                      <Campo label="Capacidad alimentador" value={fichaDatos.capacidadAlimentador} />
                      {(fichaDatos.tensionTrabajoMin || fichaDatos.tensionTrabajoMax) && (
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Tensión de trabajo</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-lg px-3 py-2 text-center">
                              <p className="font-mono text-xs text-slate-500 mb-0.5">MÍN</p>
                              <p className="font-mono text-sm text-green-400 font-600">{fichaDatos.tensionTrabajoMin || '—'}</p>
                            </div>
                            <div className="w-6 h-px bg-slate-600 flex-shrink-0" />
                            <div className="flex-1 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-lg px-3 py-2 text-center">
                              <p className="font-mono text-xs text-slate-500 mb-0.5">MÁX</p>
                              <p className="font-mono text-sm text-red-400 font-600">{fichaDatos.tensionTrabajoMax || '—'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {fichaDatos.limitacion && (
                        <div className="col-span-2 flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Limitación</span>
                          <span className="text-sm text-[var(--c-text)] font-500">
                            {fichaDatos.limitacion}{fichaDatos.tipoLimitacion ? ` — ${fichaDatos.tipoLimitacion}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-[var(--c-border-sub)]" />

                {/* ── CONTACTOS ── */}
                {editando ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">CONTACTOS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Contacto planta" value={form?.contactoNombre ?? ''} onChange={set('contactoNombre')} placeholder="Nombre" />
                      <InputField label="Teléfono planta" value={form?.contactoTelefono ?? ''} onChange={set('contactoTelefono')} placeholder="+56 9 XXXX XXXX" mono />
                      <InputField label="Contacto distribuidora" value={form?.contactoDistribuidora ?? ''} onChange={set('contactoDistribuidora')} placeholder="Nombre" />
                      <InputField label="Teléfono distribuidora" value={form?.telefonoDistribuidora ?? ''} onChange={set('telefonoDistribuidora')} placeholder="+56 9 XXXX XXXX" mono />
                      <InputField label="Emergencias" value={form?.contactoEmergencia ?? ''} onChange={set('contactoEmergencia')} placeholder="ej: SODI, Bomberos..." fullWidth />
                    </div>
                  </div>
                ) : (
                  <Seccion icon={<Phone size={13} />} title="CONTACTOS">
                    <Campo label="Contacto planta" value={fichaDatos.contactoNombre} />
                    <Campo label="Teléfono planta" value={fichaDatos.contactoTelefono} />
                    <Campo label="Contacto distribuidora" value={fichaDatos.contactoDistribuidora} />
                    <Campo label="Teléfono distribuidora" value={fichaDatos.telefonoDistribuidora} />
                    <Campo label="Emergencias" value={fichaDatos.contactoEmergencia} />
                  </Seccion>
                )}

                <div className="border-t border-[var(--c-border-sub)]" />

                {/* ── OPERACIÓN ── */}
                {editando ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings size={13} className="text-slate-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">OPERACIÓN</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TextareaField label="Procedimientos de apertura / cierre" value={form?.procedimientos ?? ''} onChange={set('procedimientos')} placeholder="Pasos para operar, secuencia de maniobras..." />
                      <TextareaField label="Observaciones generales" value={form?.observaciones ?? ''} onChange={set('observaciones')} placeholder="Restricciones, notas del operador..." />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings size={13} className="text-slate-400" />
                      <span className="font-display font-600 text-xs tracking-widest text-slate-400">OPERACIÓN</span>
                    </div>
                    {fichaDatos.procedimientos && (
                      <div className="space-y-1">
                        <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Procedimientos</span>
                        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-3 text-sm text-[var(--c-text-2)] whitespace-pre-wrap leading-relaxed">
                          {fichaDatos.procedimientos}
                        </div>
                      </div>
                    )}
                    {fichaDatos.observaciones && (
                      <div className="space-y-1">
                        <span className="font-mono text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertTriangle size={11} className="text-amber-400" /> Observaciones
                        </span>
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-[var(--c-text-2)] whitespace-pre-wrap leading-relaxed">
                          {fichaDatos.observaciones}
                        </div>
                      </div>
                    )}
                    {!fichaDatos.procedimientos && !fichaDatos.observaciones && (
                      <p className="text-xs font-mono text-slate-600">Sin información operacional registrada</p>
                    )}
                  </div>
                )}

                {/* Estado vacío */}
                {!editando && !fichaDatos.tipoPlanta && !fichaDatos.potenciaInstaladaDC && !fichaDatos.tensionAlimentador && !fichaDatos.contactoNombre && !fichaDatos.procedimientos && (
                  <div className="flex flex-col items-center gap-3 py-4 text-center border-t border-[var(--c-border-sub)] pt-6">
                    <div className="w-12 h-12 rounded-xl bg-[var(--c-inner)] border border-[var(--c-border-sub)] flex items-center justify-center">
                      <FileText size={20} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-slate-500 font-mono text-sm">Ficha sin completar</p>
                      {!soloLectura && (
                        <button onClick={iniciarEdicion} className="mt-2 text-xs text-amber-400/70 hover:text-amber-400 font-mono underline underline-offset-2 transition-colors">
                          Completar ficha técnica
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
