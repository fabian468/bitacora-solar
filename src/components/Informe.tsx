'use client';
// src/components/Informe.tsx
import { useState, useEffect, useCallback } from 'react';
import { RegistroBitacora, TipoInforme, InformeGuardado } from '@/lib/types';
import { guardarInforme, obtenerInformes, eliminarInforme } from '@/lib/informes';
import {
  FileText, Loader2, Calendar, AlertCircle,
  CheckCircle, Clock, ClipboardCopy, ClipboardCheck,
  ChevronDown, ChevronUp, Zap, Save, Trash2,
  ArrowRightLeft, Sun, BookOpen, X, ChevronRight
} from 'lucide-react';

interface Props {
  registros: RegistroBitacora[];
}

function formatDate(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

function formatDatetime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function calcDuracion(r: RegistroBitacora): string {
  try {
    const ini = new Date(`${r.fechaInicio}T${r.horaInicio}`);
    const fin = new Date(`${r.fechaFin}T${r.horaFin}`);
    const diff = fin.getTime() - ini.getTime();
    if (diff <= 0) return '-';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return '-'; }
}

function RenderMarkdown({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  return (
    <div className="space-y-2">
      {lineas.map((linea, i) => {
        if (linea.startsWith('# ')) {
          return (
            <h1 key={i} className="font-display font-700 text-2xl text-[var(--c-text)] tracking-wide mt-4 mb-2">
              {linea.replace('# ', '')}
            </h1>
          );
        }
        if (linea.startsWith('## ')) {
          return (
            <h2 key={i} className="font-display font-600 text-lg text-amber-400 uppercase tracking-widest mt-6 mb-2 border-b border-[var(--c-border-sub)] pb-1">
              {linea.replace('## ', '')}
            </h2>
          );
        }
        if (linea.startsWith('**') && linea.endsWith('**')) {
          return (
            <p key={i} className="text-[var(--c-text)] font-600 text-sm">
              {linea.replace(/\*\*/g, '')}
            </p>
          );
        }
        if (linea.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-[var(--c-text-2)] text-sm">
              <span className="text-amber-400 mt-0.5 flex-shrink-0">›</span>
              <span dangerouslySetInnerHTML={{
                __html: linea.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--c-text)]">$1</strong>')
              }} />
            </div>
          );
        }
        if (linea.trim() === '') return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-[var(--c-text-2)] text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: linea.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--c-text)]">$1</strong>')
            }}
          />
        );
      })}
    </div>
  );
}

const TIPO_CONFIG: Record<TipoInforme, {
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
}> = {
  diario: {
    label: 'RESUMEN DEL DÍA',
    desc: 'Qué pasó hoy, estado general y eventos del período',
    icon: <Sun size={16} />,
    color: 'amber',
    colorBg: 'bg-amber-500/10',
    colorBorder: 'border-amber-500/40',
    colorText: 'text-amber-400',
  },
  turno: {
    label: 'ENTREGA DE TURNO',
    desc: 'Pendientes, acciones tomadas y novedades para el turno entrante',
    icon: <ArrowRightLeft size={16} />,
    color: 'cyan',
    colorBg: 'bg-cyan-500/10',
    colorBorder: 'border-cyan-500/40',
    colorText: 'text-cyan-400',
  },
};

export default function Informe({ registros }: Props) {
  const hoy = new Date().toISOString().split('T')[0];
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [tipoInforme, setTipoInforme] = useState<TipoInforme>('diario');
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [clienteFiltro, setClienteFiltro] = useState<'todos' | 'Carbon Free' | 'Matrix' | 'Opde' | 'Eolicas'>('todos');
  const [generando, setGenerando] = useState(false);
  const [informe, setInforme] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [mostrarEventos, setMostrarEventos] = useState(false);

  // Guardados
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [informesGuardados, setInformesGuardados] = useState<InformeGuardado[]>([]);
  const [cargandoGuardados, setCargandoGuardados] = useState(false);
  const [mostrarGuardados, setMostrarGuardados] = useState(false);
  const [informeAbierto, setInformeAbierto] = useState<InformeGuardado | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Para turno: incluye todo (planta + oficina). Para diario: excluye oficina.
  const registrosFiltrados = registros.filter(r => {
    const enRango = r.fechaInicio >= fechaDesde && r.fechaInicio <= fechaHasta;
    const enCliente = clienteFiltro === 'todos' || r.cliente === clienteFiltro;
    const enTipo = tipoInforme === 'turno' || r.tipo !== 'oficina';
    return enRango && enCliente && enTipo;
  });

  const pendientes = registrosFiltrados.filter(r => r.estado !== 'resuelto');
  const resueltos = registrosFiltrados.filter(r => r.estado === 'resuelto');

  const cargarGuardados = useCallback(async () => {
    setCargandoGuardados(true);
    try {
      const data = await obtenerInformes();
      setInformesGuardados(data);
    } catch { /* silencio */ }
    finally { setCargandoGuardados(false); }
  }, []);

  useEffect(() => { cargarGuardados(); }, [cargarGuardados]);

  // Al cambiar tipo, ajustar fechas por defecto
  useEffect(() => {
    if (tipoInforme === 'diario') {
      setFechaDesde(hoy);
      setFechaHasta(hoy);
    } else {
      setFechaDesde(hoy);
      setFechaHasta(hoy);
    }
    setInforme('');
    setError('');
    setGuardado(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoInforme]);

  const generarInforme = async () => {
    if (registrosFiltrados.length === 0) {
      setError('No hay registros en el período seleccionado.');
      return;
    }
    setGenerando(true);
    setError('');
    setInforme('');
    setGuardado(false);
    try {
      const res = await fetch('/api/informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registros: registrosFiltrados,
          fechaDesde: formatDate(fechaDesde),
          fechaHasta: formatDate(fechaHasta),
          tipoInforme,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setInforme(data.informe);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
    } finally {
      setGenerando(false);
    }
  };

  const handleGuardar = async () => {
    if (!informe) return;
    setGuardando(true);
    try {
      const cfg = TIPO_CONFIG[tipoInforme];
      const titulo = `${cfg.label} · ${formatDate(fechaDesde)}${fechaDesde !== fechaHasta ? ` — ${formatDate(fechaHasta)}` : ''}`;
      await guardarInforme({
        tipo: tipoInforme,
        titulo,
        contenido: informe,
        cliente: clienteFiltro,
        fechaDesde: formatDate(fechaDesde),
        fechaHasta: formatDate(fechaHasta),
        totalEventos: registrosFiltrados.length,
      });
      setGuardado(true);
      await cargarGuardados();
    } catch {
      setError('Error al guardar el informe en la base de datos.');
    } finally {
      setGuardando(false);
    }
  };

  const copiarInforme = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); }
    catch {
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleEliminar = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await eliminarInforme(id);
      setConfirmDelete(null);
      if (informeAbierto?.id === id) setInformeAbierto(null);
      await cargarGuardados();
    } catch { /* silencio */ }
  };

  const setRango = (dias: number) => {
    const desde = dias === 0 ? hoy : new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFechaDesde(desde);
    setFechaHasta(hoy);
    setInforme('');
    setError('');
    setGuardado(false);
  };

  const cfg = TIPO_CONFIG[tipoInforme];

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

      {/* ── MODAL INFORME GUARDADO ── */}
      {informeAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setInformeAbierto(null); }}
        >
          <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border-sub)] flex-shrink-0">
              <div className="min-w-0">
                <p className={`font-mono text-xs uppercase tracking-widest mb-0.5 ${informeAbierto.tipo === 'turno' ? 'text-cyan-400' : 'text-amber-400'}`}>
                  {TIPO_CONFIG[informeAbierto.tipo].label}
                </p>
                <p className="font-display font-600 text-sm text-[var(--c-text)] truncate">{informeAbierto.titulo}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => copiarInforme(informeAbierto.contenido)}
                  className={`p-2 rounded-lg text-xs font-mono border transition-all ${copiado ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'btn-ghost'}`}
                  title="Copiar"
                >
                  {copiado ? <ClipboardCheck size={14} /> : <ClipboardCopy size={14} />}
                </button>
                <button onClick={() => setInformeAbierto(null)} className="p-2 rounded-lg text-slate-500 hover:text-[var(--c-text-2)] hover:bg-[var(--c-inner)] transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <RenderMarkdown texto={informeAbierto.contenido} />
            </div>
            <div className="px-6 py-3 border-t border-[var(--c-border-sub)] flex items-center justify-between flex-shrink-0">
              <p className="font-mono text-xs text-slate-600">
                {formatDatetime(informeAbierto.createdAt!)} · {informeAbierto.totalEventos} eventos · {informeAbierto.cliente !== 'todos' ? informeAbierto.cliente : 'Todos los clientes'}
              </p>
              <button
                onClick={() => handleEliminar(informeAbierto.id!)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  confirmDelete === informeAbierto.id
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'border-[var(--c-border)] text-slate-500 hover:text-red-400 hover:border-red-400/40'
                }`}
              >
                <Trash2 size={11} />
                {confirmDelete === informeAbierto.id ? '¿Confirmar?' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIGURADOR ── */}
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 sm:p-6">

        {/* Título */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <FileText size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-700 text-lg text-[var(--c-text)] tracking-wide">GENERAR INFORME</h2>
            <p className="text-xs text-slate-500">Elige el tipo de informe y el período</p>
          </div>
        </div>

        {/* Selector tipo de informe */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {(Object.keys(TIPO_CONFIG) as TipoInforme[]).map(tipo => {
            const c = TIPO_CONFIG[tipo];
            const activo = tipoInforme === tipo;
            return (
              <button
                key={tipo}
                onClick={() => setTipoInforme(tipo)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  activo
                    ? `${c.colorBg} ${c.colorBorder}`
                    : 'border-[var(--c-border-sub)] hover:border-[var(--c-border)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={activo ? c.colorText : 'text-slate-500'}>{c.icon}</span>
                  <span className={`font-display font-700 text-sm tracking-widest ${activo ? c.colorText : 'text-slate-400'}`}>
                    {c.label}
                  </span>
                  {activo && (
                    <span className={`ml-auto text-xs font-mono ${c.colorText}`}>✓</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Filtro cliente */}
        <div className="flex gap-2 mb-5">
          {(['todos', 'Carbon Free', 'Matrix', 'Opde', 'Eolicas'] as const).map(c => (
            <button
              key={c}
              onClick={() => { setClienteFiltro(c); setInforme(''); setError(''); setGuardado(false); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                clienteFiltro === c
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'border-[var(--c-border)] text-slate-500 hover:text-[var(--c-text-2)] hover:border-slate-500'
              }`}
            >
              {c === 'todos' ? 'Todos' : c}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'Hoy', dias: 0 },
            { label: 'Últimos 7 días', dias: 7 },
            { label: 'Últimos 15 días', dias: 15 },
            { label: 'Último mes', dias: 30 },
          ].map(({ label, dias }) => (
            <button key={label} onClick={() => setRango(dias)} className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono">
              {label}
            </button>
          ))}
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={11} /> Desde
            </label>
            <input type="date" value={fechaDesde}
              onChange={e => { setFechaDesde(e.target.value); setInforme(''); setError(''); setGuardado(false); }}
              className="input-solar w-full rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={11} /> Hasta
            </label>
            <input type="date" value={fechaHasta}
              onChange={e => { setFechaHasta(e.target.value); setInforme(''); setError(''); setGuardado(false); }}
              className="input-solar w-full rounded-xl px-3 py-2.5 text-sm" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-3 text-center">
            <p className="font-mono text-xl sm:text-2xl font-600 text-[var(--c-text)]">{registrosFiltrados.length}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">Total eventos</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
            <p className="font-mono text-xl sm:text-2xl font-600 text-amber-400">{pendientes.length}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">⏳ Pendientes</p>
          </div>
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-center">
            <p className="font-mono text-xl sm:text-2xl font-600 text-green-400">{resueltos.length}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">✓ Resueltos</p>
          </div>
        </div>

        {/* Lista colapsable */}
        {registrosFiltrados.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setMostrarEventos(!mostrarEventos)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Ver {registrosFiltrados.length} evento{registrosFiltrados.length !== 1 ? 's' : ''} del período</span>
              {mostrarEventos ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {mostrarEventos && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                {registrosFiltrados.map((r, i) => (
                  <div key={r.id || i} className="flex items-start gap-3 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-2.5">
                    <div className="flex-shrink-0 mt-0.5">
                      {r.estado === 'resuelto'
                        ? <CheckCircle size={13} className="text-green-400" />
                        : <Clock size={13} className="text-amber-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--c-text)] text-xs font-500 truncate">{r.acontecimiento}</p>
                      <p className="font-mono text-xs text-slate-500">{r.planta} · {formatDate(r.fechaInicio)} {r.horaInicio} · ⏱ {calcDuracion(r)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          onClick={generarInforme}
          disabled={generando || registrosFiltrados.length === 0}
          className={`w-full py-3 rounded-xl font-display font-700 text-sm flex items-center justify-center gap-2 tracking-wider transition-all border ${
            registrosFiltrados.length > 0 && !generando
              ? tipoInforme === 'diario'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25'
              : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
          }`}
        >
          {generando
            ? <><Loader2 size={16} className="spin-slow" /> GENERANDO...</>
            : <>{cfg.icon} GENERAR {cfg.label}</>
          }
        </button>
      </div>

      {/* ── RESULTADO ── */}
      {informe && (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border-sub)]">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${cfg.colorBg} border ${cfg.colorBorder} flex items-center justify-center`}>
                <span className={cfg.colorText}>{cfg.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs uppercase tracking-widest ${cfg.colorText}`}>
                    {cfg.label}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {formatDate(fechaDesde)}{fechaDesde !== fechaHasta ? ` — ${formatDate(fechaHasta)}` : ''} · {registrosFiltrados.length} eventos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copiarInforme(informe)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  copiado ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'btn-ghost'
                }`}
              >
                {copiado ? <ClipboardCheck size={12} /> : <ClipboardCopy size={12} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando || guardado}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  guardado
                    ? 'bg-green-500/20 border-green-500/40 text-green-400 cursor-default'
                    : guardando
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 cursor-wait'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                {guardando ? <Loader2 size={12} className="spin-slow" /> : <Save size={12} />}
                {guardado ? '¡Guardado!' : guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          <div className="px-6 py-6">
            <RenderMarkdown texto={informe} />
          </div>

          <div className="px-6 py-3 border-t border-[var(--c-border-sub)] flex items-center justify-between">
            <p className="font-mono text-xs text-slate-600">
              {clienteFiltro !== 'todos' ? `${clienteFiltro} · ` : ''}{registrosFiltrados.length} eventos
            </p>
            <button onClick={generarInforme} disabled={generando} className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5">
              <Loader2 size={11} className={generando ? 'spin-slow' : ''} />
              Regenerar
            </button>
          </div>
        </div>
      )}

      {/* ── INFORMES GUARDADOS ── */}
      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
        <button
          onClick={() => setMostrarGuardados(!mostrarGuardados)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--c-inner)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--c-inner)] border border-[var(--c-border-sub)] flex items-center justify-center">
              <BookOpen size={15} className="text-slate-400" />
            </div>
            <div className="text-left">
              <p className="font-display font-600 text-sm text-[var(--c-text)] tracking-wide">INFORMES GUARDADOS</p>
              <p className="font-mono text-xs text-slate-500">
                {cargandoGuardados ? 'Cargando...' : `${informesGuardados.length} informe${informesGuardados.length !== 1 ? 's' : ''} en base de datos`}
              </p>
            </div>
          </div>
          {mostrarGuardados ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
        </button>

        {mostrarGuardados && (
          <div className="border-t border-[var(--c-border-sub)]">
            {cargandoGuardados && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="spin-slow text-amber-400" />
              </div>
            )}

            {!cargandoGuardados && informesGuardados.length === 0 && (
              <div className="text-center py-10">
                <p className="font-mono text-sm text-slate-500">No hay informes guardados aún</p>
                <p className="text-xs text-slate-600 mt-1">Genera un informe y presiona "Guardar"</p>
              </div>
            )}

            {!cargandoGuardados && informesGuardados.length > 0 && (
              <div className="p-4 space-y-2">
                {informesGuardados.map(inf => {
                  const c = TIPO_CONFIG[inf.tipo];
                  return (
                    <button
                      key={inf.id}
                      onClick={() => { setInformeAbierto(inf); setConfirmDelete(null); }}
                      className="w-full text-left bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-3 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-lg ${c.colorBg} border ${c.colorBorder} flex items-center justify-center flex-shrink-0`}>
                            <span className={c.colorText + ' [&>svg]:w-3 [&>svg]:h-3'}>{c.icon}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[var(--c-text)] text-sm font-500 truncate">{inf.titulo}</p>
                            <p className="font-mono text-xs text-slate-500 mt-0.5">
                              {formatDatetime(inf.createdAt!)} · {inf.totalEventos} eventos
                              {inf.cliente !== 'todos' ? ` · ${inf.cliente}` : ''}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-slate-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
