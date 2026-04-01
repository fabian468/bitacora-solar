'use client';
// src/components/Dashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { RegistroBitacora, Planta, Cliente, CLIENTES } from '@/lib/types';
import { obtenerConfig, guardarConfig, DashboardConfig } from '@/lib/dashboard';
import {
  Activity, AlertTriangle, CheckCircle2, Clock,
  Target, FileText, Settings, X, Save, Camera,
} from 'lucide-react';

interface Props {
  registros: RegistroBitacora[];
  plantas: Planta[];
  esAdmin: boolean;
  onConfigChange?: () => void;
}

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function ultimosMeses(n: number): Array<{ key: string; label: string }> {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MESES_ES[d.getMonth()],
    });
  }
  return result;
}

function calcDurHoras(r: RegistroBitacora): number | null {
  try {
    const ini = new Date(`${r.fechaInicio}T${r.horaInicio}`);
    const fin = new Date(`${r.fechaFin}T${r.horaFin}`);
    const h = (fin.getTime() - ini.getTime()) / 3600000;
    return h > 0 && h < 720 ? h : null;
  } catch { return null; }
}

function BarraHorizontal({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-[var(--c-bg)] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard({ registros, plantas, esAdmin, onConfigChange }: Props) {
  const [config, setConfig] = useState<DashboardConfig>({ metaResolucion: 80, metaMTTR: 4, notas: '', fotosHabilitadas: true });
  const [editando, setEditando] = useState(false);
  const [formConfig, setFormConfig] = useState<DashboardConfig>(config);
  const [guardando, setGuardando] = useState(false);
  const [clienteFiltro, setClienteFiltro] = useState<Cliente | 'todos'>('todos');

  useEffect(() => {
    obtenerConfig().then(c => { setConfig(c); setFormConfig(c); });
  }, []);

  const regs = useMemo(
    () => clienteFiltro === 'todos' ? registros : registros.filter(r => r.cliente === clienteFiltro),
    [registros, clienteFiltro],
  );

  // ── KPIs ──
  const total = regs.length;
  const resueltos = regs.filter(r => r.estado === 'resuelto').length;
  const pendientes = regs.filter(r => r.estado !== 'resuelto').length;
  const tasaResolucion = total > 0 ? Math.round((resueltos / total) * 100) : 0;
  const hoy = new Date().toISOString().split('T')[0];
  const deHoy = regs.filter(r => r.fechaInicio === hoy).length;

  const duraciones = regs
    .filter(r => r.estado === 'resuelto')
    .map(calcDurHoras)
    .filter((h): h is number => h !== null);
  const mttr = duraciones.length > 0
    ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length
    : 0;
  const mttrDisplay = mttr === 0 ? '—'
    : mttr < 1 ? `${Math.round(mttr * 60)}m`
    : mttr < 24 ? `${mttr.toFixed(1)}h`
    : `${(mttr / 24).toFixed(1)}d`;

  // ── Evolución mensual ──
  const meses = ultimosMeses(6);
  const porMes = meses.map(({ key, label }) => ({
    key, label,
    count: regs.filter(r => r.fechaInicio?.startsWith(key)).length,
  }));
  const maxMes = Math.max(...porMes.map(m => m.count), 1);

  // ── Top plantas ──
  const contPorPlanta: Record<string, number> = {};
  regs.forEach(r => { contPorPlanta[r.planta] = (contPorPlanta[r.planta] || 0) + 1; });
  const topPlantas = Object.entries(contPorPlanta).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxPlanta = topPlantas[0]?.[1] || 1;

  // ── Top causas ──
  const contPorCausa: Record<string, number> = {};
  regs.forEach(r => { if (r.causa) contPorCausa[r.causa] = (contPorCausa[r.causa] || 0) + 1; });
  const topCausas = Object.entries(contPorCausa).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCausa = topCausas[0]?.[1] || 1;

  // ── Top acontecimientos ──
  const contPorAcont: Record<string, number> = {};
  regs.forEach(r => { if (r.acontecimiento) contPorAcont[r.acontecimiento] = (contPorAcont[r.acontecimiento] || 0) + 1; });
  const topAcont = Object.entries(contPorAcont).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxAcont = topAcont[0]?.[1] || 1;

  // ── Por cliente (siempre sobre total global) ──
  const porCliente = CLIENTES.map(c => ({
    cliente: c,
    count: registros.filter(r => r.cliente === c).length,
  }));
  const maxCliente = Math.max(...porCliente.map(c => c.count), 1);

  // ── Colores según meta ──
  const tasaColor = tasaResolucion >= config.metaResolucion ? 'text-green-400'
    : tasaResolucion >= config.metaResolucion * 0.7 ? 'text-amber-400'
    : 'text-red-400';
  const tasaBarColor = tasaResolucion >= config.metaResolucion ? 'bg-green-500'
    : tasaResolucion >= config.metaResolucion * 0.7 ? 'bg-amber-500'
    : 'bg-red-500';
  const mttrColor = mttr === 0 ? 'text-slate-400'
    : mttr <= config.metaMTTR ? 'text-green-400'
    : mttr <= config.metaMTTR * 1.5 ? 'text-amber-400'
    : 'text-red-400';

  const handleGuardar = async () => {
    setGuardando(true);
    await guardarConfig(formConfig);
    setConfig(formConfig);
    setEditando(false);
    setGuardando(false);
    onConfigChange?.();
  };

  return (
    <div className="space-y-6">

      {/* ── Cabecera ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-700 text-xl text-[var(--c-text)] tracking-widest">DASHBOARD</h2>
          <p className="font-mono text-xs text-slate-500 mt-0.5">Métricas y KPIs del sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro cliente */}
          <div className="flex gap-1">
            {(['todos', 'Carbon Free', 'Matrix', 'Opde', 'Eolicas'] as const).map(c => (
              <button
                key={c}
                onClick={() => setClienteFiltro(c as typeof clienteFiltro)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all ${
                  clienteFiltro === c
                    ? c === 'todos'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : c === 'Carbon Free'
                      ? 'bg-green-500/15 border-green-500/40 text-green-400'
                      : c === 'Matrix'
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                      : c === 'Opde'
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                      : 'bg-violet-500/15 border-violet-500/40 text-violet-400'
                    : 'border-[var(--c-border-sub)] text-slate-500 hover:text-[var(--c-text-2)]'
                }`}
              >
                {c === 'todos' ? 'Todos' : c}
              </button>
            ))}
          </div>

          {esAdmin && (
            <button
              onClick={() => { setFormConfig(config); setEditando(true); }}
              className="btn-ghost px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs"
            >
              <Settings size={13} />
              Configurar
            </button>
          )}
        </div>
      </div>

      {/* ── Notas admin ── */}
      {config.notas && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <FileText size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{config.notas}</p>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Total */}
        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Total eventos</span>
            <Activity size={14} className="text-amber-400" />
          </div>
          <div className="font-display font-700 text-3xl text-[var(--c-text)]">{total}</div>
          <div className="font-mono text-xs text-slate-500">
            <span className="text-amber-400 font-500">{deHoy}</span> hoy
          </div>
        </div>

        {/* Pendientes */}
        <div className={`bg-[var(--c-inner)] border rounded-2xl p-4 space-y-2 ${pendientes > 0 ? 'border-red-500/30' : 'border-[var(--c-border-sub)]'}`}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Pendientes</span>
            <AlertTriangle size={14} className={pendientes > 0 ? 'text-red-400' : 'text-slate-600'} />
          </div>
          <div className={`font-display font-700 text-3xl ${pendientes > 0 ? 'text-red-400' : 'text-slate-500'}`}>{pendientes}</div>
          <div className="font-mono text-xs text-slate-500">
            <span className="text-slate-400">{resueltos}</span> resueltos
          </div>
        </div>

        {/* Tasa resolución */}
        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Resolución</span>
            <CheckCircle2 size={14} className="text-green-400" />
          </div>
          <div className={`font-display font-700 text-3xl ${tasaColor}`}>{tasaResolucion}%</div>
          <div className="space-y-1">
            <div className="h-1.5 bg-[var(--c-bg)] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${tasaBarColor}`} style={{ width: `${tasaResolucion}%` }} />
            </div>
            <div className="font-mono text-xs text-slate-600 flex items-center gap-1">
              <Target size={9} /> meta: {config.metaResolucion}%
            </div>
          </div>
        </div>

        {/* MTTR */}
        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">MTTR</span>
            <Clock size={14} className="text-cyan-400" />
          </div>
          <div className={`font-display font-700 text-3xl ${mttrColor}`}>{mttrDisplay}</div>
          <div className="font-mono text-xs text-slate-600 flex items-center gap-1">
            <Target size={9} /> meta: &lt;{config.metaMTTR}h &nbsp;·&nbsp; {duraciones.length} muestras
          </div>
        </div>

      </div>

      {/* ── Evolución mensual ── */}
      <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-5">
        <h3 className="font-display font-600 text-sm text-slate-400 uppercase tracking-widest mb-5">
          Evolución últimos 6 meses
        </h3>
        <div className="flex items-end gap-2" style={{ height: '120px' }}>
          {porMes.map(({ key, label, count }) => (
            <div key={key} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <span className="font-mono text-xs text-slate-500 h-4">{count > 0 ? count : ''}</span>
              <div className="w-full flex-1 flex items-end justify-center">
                <div
                  title={`${label}: ${count} eventos`}
                  className="w-full max-w-14 rounded-t-lg bg-amber-500/40 border border-amber-500/30 hover:bg-amber-500/60 transition-colors cursor-default"
                  style={{ height: `${count === 0 ? 3 : Math.max(8, Math.round((count / maxMes) * 72))}px` }}
                />
              </div>
              <span className="font-mono text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top plantas + Top causas ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-sm text-slate-400 uppercase tracking-widest">Top plantas</h3>
          {topPlantas.length === 0
            ? <p className="font-mono text-xs text-slate-600">Sin datos</p>
            : topPlantas.map(([planta, count], i) => (
              <div key={planta} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-slate-600 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="font-mono text-xs text-[var(--c-text-2)] truncate">{planta}</span>
                  </div>
                  <span className="font-mono text-xs text-amber-400 flex-shrink-0">{count}</span>
                </div>
                <BarraHorizontal pct={Math.round((count / maxPlanta) * 100)} color="bg-amber-500/50" />
              </div>
            ))
          }
        </div>

        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-sm text-slate-400 uppercase tracking-widest">Top causas</h3>
          {topCausas.length === 0
            ? <p className="font-mono text-xs text-slate-600">Sin datos</p>
            : topCausas.map(([causa, count], i) => (
              <div key={causa} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-slate-600 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="font-mono text-xs text-[var(--c-text-2)] truncate">{causa}</span>
                  </div>
                  <span className="font-mono text-xs text-cyan-400 flex-shrink-0">{count}</span>
                </div>
                <BarraHorizontal pct={Math.round((count / maxCausa) * 100)} color="bg-cyan-500/50" />
              </div>
            ))
          }
        </div>

      </div>

      {/* ── Por cliente + Top acontecimientos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-sm text-slate-400 uppercase tracking-widest">Distribución por cliente</h3>
          {porCliente.map(({ cliente, count }) => {
            const isCF = cliente === 'Carbon Free';
            const isOpde = cliente === 'Opde';
            const isEolicas = cliente === 'Eolicas';
            const pct = registros.length > 0 ? Math.round((count / registros.length) * 100) : 0;
            return (
              <div key={cliente} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCF ? 'bg-green-400' : isOpde ? 'bg-orange-400' : isEolicas ? 'bg-violet-400' : 'bg-cyan-400'}`} />
                    <span className="font-mono text-xs text-[var(--c-text-2)]">{cliente}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-mono text-xs font-500 ${isCF ? 'text-green-400' : isOpde ? 'text-orange-400' : isEolicas ? 'text-violet-400' : 'text-cyan-400'}`}>{count}</span>
                    <span className="font-mono text-xs text-slate-600">{pct}%</span>
                  </div>
                </div>
                <BarraHorizontal
                  pct={Math.round((count / maxCliente) * 100)}
                  color={isCF ? 'bg-green-500/50' : isOpde ? 'bg-orange-500/50' : isEolicas ? 'bg-violet-500/50' : 'bg-cyan-500/50'}
                />
              </div>
            );
          })}
        </div>

        <div className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-sm text-slate-400 uppercase tracking-widest">Top acontecimientos</h3>
          {topAcont.length === 0
            ? <p className="font-mono text-xs text-slate-600">Sin datos</p>
            : topAcont.map(([acont, count], i) => (
              <div key={acont} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-slate-600 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="font-mono text-xs text-[var(--c-text-2)] truncate">{acont}</span>
                  </div>
                  <span className="font-mono text-xs text-amber-400 flex-shrink-0">{count}</span>
                </div>
                <BarraHorizontal pct={Math.round((count / maxAcont) * 100)} color="bg-amber-500/30" />
              </div>
            ))
          }
        </div>

      </div>

      {/* ── Modal configuración (solo admin) ── */}
      {editando && esAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--c-bg)] border border-[var(--c-border-sub)] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">

            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-700 text-lg text-[var(--c-text)] tracking-wider">CONFIGURAR DASHBOARD</h3>
                <p className="font-mono text-xs text-slate-500 mt-0.5">Cambios visibles para todos los usuarios</p>
              </div>
              <button onClick={() => setEditando(false)} className="btn-ghost p-2 rounded-xl flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">

              {/* Meta resolución */}
              <div className="space-y-2">
                <label className="font-mono text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Meta de resolución
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0} max={100} step={5}
                    value={formConfig.metaResolucion}
                    onChange={e => setFormConfig(p => ({ ...p, metaResolucion: +e.target.value }))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-display font-700 text-xl text-amber-400 w-14 text-right">
                    {formConfig.metaResolucion}%
                  </span>
                </div>
              </div>

              {/* Meta MTTR */}
              <div className="space-y-2">
                <label className="font-mono text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} /> Meta MTTR (horas)
                </label>
                <input
                  type="number"
                  min={0.5} max={168} step={0.5}
                  value={formConfig.metaMTTR}
                  onChange={e => setFormConfig(p => ({ ...p, metaMTTR: +e.target.value }))}
                  className="input-solar w-full rounded-xl px-4 py-2.5 text-sm"
                />
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <label className="font-mono text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={12} /> Notas del dashboard
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Mantenimiento programado para la próxima semana..."
                  value={formConfig.notas}
                  onChange={e => setFormConfig(p => ({ ...p, notas: e.target.value }))}
                  className="input-solar w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                />
                <p className="font-mono text-xs text-slate-600">Aparece como aviso en la parte superior del dashboard.</p>
              </div>

              {/* Toggle fotos */}
              <div className="flex items-center justify-between bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Camera size={14} className={formConfig.fotosHabilitadas ? 'text-amber-400' : 'text-slate-600'} />
                  <div>
                    <p className="font-mono text-xs text-[var(--c-text-2)]">Subida de fotos</p>
                    <p className="font-mono text-xs text-slate-500">
                      {formConfig.fotosHabilitadas ? 'Habilitada para todos' : 'Bloqueada — solo admins'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormConfig(p => ({ ...p, fotosHabilitadas: !p.fotosHabilitadas }))}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    formConfig.fotosHabilitadas ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    formConfig.fotosHabilitadas ? 'left-[22px]' : 'left-0.5'
                  }`} />
                </button>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditando(false)} className="btn-ghost px-4 py-2 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60"
              >
                {guardando
                  ? <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full spin-slow" />
                  : <Save size={14} />}
                Guardar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
