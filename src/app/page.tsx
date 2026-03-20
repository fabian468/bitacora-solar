'use client';
// src/app/page.tsx
import { useState, useEffect, useCallback } from 'react';
import { obtenerRegistros } from '@/lib/bitacora';
import { obtenerPlantas } from '@/lib/plantas';
import { RegistroBitacora, Planta, Cliente, CLIENTES } from '@/lib/types';
import CardRegistro from '@/components/CardRegistro';
import FormularioRegistro from '@/components/FormularioRegistro';
import EscanearCuaderno from '@/components/EscanearCuaderno';
import Informe from '@/components/Informe';
import GestionPlantas from '@/components/GestionPlantas';
import GestionDespachos from '@/components/GestionDespachos';
import GestionAnyDesk from '@/components/GestionAnyDesk';
import ConfigTelegram from '@/components/ConfigTelegram';
import InformesNocturnos from '@/components/InformesNocturnos';
import {
  Sun, Plus, RefreshCw, Search, Zap, Activity,
  BookOpen, FileText, LayoutDashboard, Building2, Bell, Truck, Monitor,
  Moon, Calendar, X
} from 'lucide-react';

type Vista = 'bitacora' | 'informe' | 'plantas' | 'despachos' | 'anydesk' | 'alertas' | 'nocturnos';

const CLIENTE_COLORES: Record<Cliente, { activo: string; inactivo: string; dot: string }> = {
  'Carbon Free': {
    activo: 'bg-green-500/15 border-green-500/40 text-green-400',
    inactivo: 'border-[var(--c-border-sub)] text-slate-500 hover:border-green-500/30 hover:text-green-400',
    dot: 'bg-green-400',
  },
  'Matrix': {
    activo: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400',
    inactivo: 'border-[var(--c-border-sub)] text-slate-500 hover:border-cyan-500/30 hover:text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function Home() {
  const [registros, setRegistros] = useState<RegistroBitacora[]>([]);
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [vista, setVista] = useState<Vista>('bitacora');
  const [clienteFiltro, setClienteFiltro] = useState<Cliente | 'todos'>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [registroAclonar, setRegistroAclonar] = useState<RegistroBitacora | undefined>(undefined);
  const [mostrarEscanear, setMostrarEscanear] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [temaOscuro, setTemaOscuro] = useState(true);

  useEffect(() => {
    const guardado = localStorage.getItem('tema');
    const oscuro = guardado !== 'light';
    setTemaOscuro(oscuro);
    document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light');
  }, []);

  const toggleTema = () => {
    const nuevo = !temaOscuro;
    setTemaOscuro(nuevo);
    document.documentElement.setAttribute('data-theme', nuevo ? 'dark' : 'light');
    localStorage.setItem('tema', nuevo ? 'dark' : 'light');
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [regs, plts] = await Promise.all([obtenerRegistros(), obtenerPlantas()]);
      setRegistros(regs);
      setPlantas(plts);
    } catch {
      setError('No se pudo conectar a Firebase. Verifica tu configuración en .env.local');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Filtros combinados
  const filtrados = registros.filter(r => {
    const matchCliente = clienteFiltro === 'todos' || r.cliente === clienteFiltro;
    const matchBusqueda = !busqueda || [r.planta, r.acontecimiento, r.causa, r.detalle]
      .some(t => t?.toLowerCase().includes(busqueda.toLowerCase()));
    const matchDesde = !fechaDesde || r.fechaInicio >= fechaDesde;
    const matchHasta = !fechaHasta || r.fechaInicio <= fechaHasta;
    return matchCliente && matchBusqueda && matchDesde && matchHasta;
  });

  const setRangoFecha = (dias: number) => {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFechaDesde(desde);
    setFechaHasta(hoy);
  };

  const hayFiltroFecha = fechaDesde || fechaHasta;

  const hoy = new Date().toISOString().split('T')[0];
  const deHoy = registros.filter(r => r.fechaInicio === hoy).length;
  const pendientes = registros.filter(r => r.estado !== 'resuelto').length;

  const contPorCliente = (c: Cliente) => registros.filter(r => r.cliente === c).length;

  return (
    <div className="min-h-screen bg-grid">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--c-border-sub)] backdrop-blur-md" style={{ backgroundColor: 'var(--c-bg)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Top bar */}
          <div className="flex items-center justify-between gap-4 py-3">

            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-gold flex-shrink-0">
                <Sun size={16} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-700 text-base sm:text-lg text-[var(--c-text)] tracking-widest leading-none truncate">
                  BITÁCORA <span className="hidden xs:inline">SOLAR</span>
                </h1>
                <p className="font-mono text-xs text-slate-500 hidden sm:block">Sistema de Registro Fotovoltaico</p>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-3 py-1.5">
                <Activity size={11} className="text-green-400" />
                <span className="font-mono text-xs text-slate-400">
                  Total: <span className="text-[var(--c-text)] font-500">{registros.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-3 py-1.5">
                <Zap size={11} className="text-amber-400" />
                <span className="font-mono text-xs text-slate-400">
                  Hoy: <span className="text-amber-400 font-500">{deHoy}</span>
                </span>
              </div>
              {pendientes > 0 && (
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="font-mono text-xs text-red-400">
                    {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Theme toggle + Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTema}
                className="btn-ghost p-2 rounded-xl"
                title={temaOscuro ? 'Modo claro' : 'Modo oscuro'}
              >
                {temaOscuro ? <Moon size={15} /> : <Sun size={15} />}
              </button>
              {vista === 'bitacora' && (
                <>
                  <button
                    onClick={() => setMostrarEscanear(true)}
                    className="btn-ghost px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs sm:text-sm"
                  >
                    <BookOpen size={14} />
                    <span className="hidden sm:inline">ESCANEAR</span>
                  </button>
                  <button
                    onClick={() => setMostrarForm(true)}
                    className="btn-primary px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs sm:text-sm"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">NUEVO</span>
                  </button>
                </>
              )}
            </div>

          </div>{/* end top bar */}

          {/* ── NAV TABS ── */}
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0">
            {[
              { key: 'bitacora', label: 'BITÁCORA', icon: <LayoutDashboard size={13} /> },
              { key: 'informe', label: 'INFORMES', icon: <FileText size={13} /> },
              { key: 'plantas', label: 'PLANTAS', icon: <Building2 size={13} /> },
              { key: 'despachos', label: 'DESPACHOS', icon: <Truck size={13} /> },
              { key: 'anydesk', label: 'ANYDESK', icon: <Monitor size={13} /> },
              { key: 'alertas', label: 'ALERTAS', icon: <Bell size={13} /> },
              { key: 'nocturnos', label: 'NOCTURNOS', icon: <Moon size={13} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setVista(tab.key as Vista)}
                className={`flex items-center gap-1.5 px-3 sm:px-5 py-2.5 text-xs font-display font-600 tracking-wider border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${vista === tab.key
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-[var(--c-text-2)]'
                  }`}
              >
                {tab.icon}
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8">

        {/* ── VISTA BITÁCORA ── */}
        {vista === 'bitacora' && (
          <>
            {/* Filtros por cliente */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button
                onClick={() => setClienteFiltro('todos')}
                className={`px-4 py-2 rounded-xl text-xs font-mono border transition-all ${clienteFiltro === 'todos'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'border-[var(--c-border-sub)] text-slate-500 hover:border-amber-500/30 hover:text-amber-400'
                  }`}
              >
                Todos ({registros.length})
              </button>
              {CLIENTES.map(c => {
                const col = CLIENTE_COLORES[c];
                const count = contPorCliente(c);
                return (
                  <button
                    key={c}
                    onClick={() => setClienteFiltro(c)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono border transition-all flex items-center gap-2 ${clienteFiltro === c ? col.activo : col.inactivo
                      }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                    {c} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search + Filtros fecha */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="Buscar por planta, acontecimiento, causa..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {[
                  { label: 'Hoy', dias: 0 },
                  { label: '7d', dias: 7 },
                  { label: '15d', dias: 15 },
                  { label: 'Mes', dias: 30 },
                ].map(({ label, dias }) => (
                  <button
                    key={label}
                    onClick={() => dias === 0
                      ? (setFechaDesde(hoy), setFechaHasta(hoy))
                      : setRangoFecha(dias)
                    }
                    className={`px-2.5 py-2 rounded-xl text-xs font-mono border transition-all ${
                      (dias === 0 && fechaDesde === hoy && fechaHasta === hoy) ||
                      (dias > 0 && fechaDesde === new Date(Date.now() - dias * 86400000).toISOString().split('T')[0] && fechaHasta === hoy)
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'border-[var(--c-border-sub)] text-slate-500 hover:border-amber-500/30 hover:text-amber-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)}
                  className="input-solar rounded-xl px-2 py-2 text-xs w-32 hidden sm:block"
                  title="Desde"
                />
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)}
                  className="input-solar rounded-xl px-2 py-2 text-xs w-32 hidden sm:block"
                  title="Hasta"
                />
                {hayFiltroFecha && (
                  <button
                    onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-400 border border-transparent hover:border-red-400/30 transition-all"
                    title="Limpiar filtro de fecha"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button onClick={cargar} className="btn-ghost p-2.5 rounded-xl flex-shrink-0">
                <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 mb-6 text-red-400 text-sm font-mono">
                ⚠ {error}
              </div>
            )}

            {cargando && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-pulse-gold">
                  <Sun size={24} className="text-amber-400 spin-slow" />
                </div>
                <p className="font-mono text-sm text-slate-500">Cargando registros...</p>
              </div>
            )}

            {!cargando && filtrados.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--c-inner)] border border-[var(--c-border-sub)] flex items-center justify-center">
                  <Sun size={30} className="text-slate-700" />
                </div>
                <div className="text-center">
                  <p className="font-display font-600 text-slate-500 text-lg tracking-wide">
                    {busqueda || clienteFiltro !== 'todos' ? 'Sin resultados' : 'Sin registros aún'}
                  </p>
                  <p className="text-slate-600 text-sm mt-1">
                    {busqueda || clienteFiltro !== 'todos'
                      ? 'Intenta cambiar los filtros'
                      : 'Crea el primer registro del día'}
                  </p>
                </div>
                {!busqueda && clienteFiltro === 'todos' && (
                  <button
                    onClick={() => setMostrarForm(true)}
                    className="btn-primary px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 mt-2"
                  >
                    <Plus size={15} /> CREAR PRIMER REGISTRO
                  </button>
                )}
              </div>
            )}

            {!cargando && filtrados.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtrados.map((r, i) => (
                  <div key={r.id} style={{ animationDelay: `${i * 0.05}s` }}>
                    <CardRegistro
                      registro={r}
                      plantas={plantas}
                      onEliminado={cargar}
                      onActualizado={cargar}
                      onClonar={reg => { setRegistroAclonar(reg); setMostrarForm(true); }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── VISTA INFORMES ── */}
        {vista === 'informe' && (
          <Informe registros={registros} />
        )}

        {/* ── VISTA PLANTAS ── */}
        {vista === 'plantas' && (
          <GestionPlantas />
        )}

        {/* ── VISTA DESPACHOS ── */}
        {vista === 'despachos' && (
          <GestionDespachos />
        )}

        {/* ── VISTA ANYDESK ── */}
        {vista === 'anydesk' && (
          <GestionAnyDesk />
        )}

        {/* ── VISTA ALERTAS ── */}
        {vista === 'alertas' && (
          <ConfigTelegram />
        )}

        {/* ── VISTA NOCTURNOS ── */}
        {vista === 'nocturnos' && (
          <InformesNocturnos />
        )}

      </main>

      {/* Modales */}
      {mostrarForm && (
        <FormularioRegistro
          onClose={() => { setMostrarForm(false); setRegistroAclonar(undefined); }}
          onCreado={() => { cargar(); setRegistroAclonar(undefined); }}
          plantas={plantas}
          registroBase={registroAclonar}
        />
      )}

      {mostrarEscanear && (
        <EscanearCuaderno
          onClose={() => setMostrarEscanear(false)}
          onGuardados={cargar}
          plantas={plantas}
        />
      )}

    </div>
  );
}
