'use client';
// src/components/ConfigTelegram.tsx
import { useState } from 'react';
import {
  Send, CheckCircle, AlertCircle, Loader2,
  Bell, ExternalLink, Copy, Check
} from 'lucide-react';

const HORAS_PRESET = [
  { label: '06:00 — Turno mañana', cron: '0 6 * * *', hora: '06:00' },
  { label: '08:00 — Inicio jornada', cron: '0 8 * * *', hora: '08:00' },
  { label: '14:00 — Turno tarde', cron: '0 14 * * *', hora: '14:00' },
  { label: '18:00 — Cierre jornada', cron: '0 18 * * *', hora: '18:00' },
  { label: '22:00 — Turno noche', cron: '0 22 * * *', hora: '22:00' },
];

export default function ConfigTelegram() {
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const [horaSeleccionada, setHoraSeleccionada] = useState('0 6 * * *');
  const [copiado, setCopiado] = useState<string | null>(null);

  const probarAlerta = async () => {
    setProbando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/telegram', { method: 'GET' });
      const data = await res.json();
      if (data.ok) {
        setResultado({ ok: true, msg: `✓ Mensaje enviado — ${data.pendientes} pendiente${data.pendientes !== 1 ? 's' : ''} notificado${data.pendientes !== 1 ? 's' : ''}` });
      } else {
        setResultado({ ok: false, msg: data.error || 'Error desconocido' });
      }
    } catch {
      setResultado({ ok: false, msg: 'No se pudo conectar con el servidor' });
    } finally {
      setProbando(false);
    }
  };

  const copiar = (texto: string, key: string) => {
    navigator.clipboard.writeText(texto).catch(() => {
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopiado(key);
    setTimeout(() => setCopiado(null), 2000);
  };

  const cronActual = HORAS_PRESET.find(h => h.cron === horaSeleccionada) ?? HORAS_PRESET[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Bell size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="font-display font-700 text-lg text-white tracking-wide">ALERTAS TELEGRAM</h2>
            <p className="text-xs text-slate-500">Recibe los eventos pendientes automáticamente</p>
          </div>
        </div>
      </div>

      {/* Paso 1 — Crear bot */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6 space-y-4">
        <h3 className="font-display font-700 text-white tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs flex items-center justify-center font-mono">1</span>
          Crear el bot en Telegram
        </h3>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-start gap-3 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3">
            <span className="text-amber-400 font-mono text-xs mt-0.5 flex-shrink-0">01</span>
            <div>
              Abre Telegram y busca <span className="text-cyan-400 font-mono">@BotFather</span>
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                className="ml-2 text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
                Abrir <ExternalLink size={11} />
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3">
            <span className="text-amber-400 font-mono text-xs mt-0.5 flex-shrink-0">02</span>
            <div>
              Escríbele <span className="font-mono bg-[#0A0E1A] px-2 py-0.5 rounded text-amber-400">/newbot</span> y sigue las instrucciones — ponle el nombre que quieras
            </div>
          </div>
          <div className="flex items-start gap-3 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3">
            <span className="text-amber-400 font-mono text-xs mt-0.5 flex-shrink-0">03</span>
            <div>
              BotFather te dará un <span className="text-white font-500">token</span> — cópialo y guárdalo
            </div>
          </div>
          <div className="flex items-start gap-3 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3">
            <span className="text-amber-400 font-mono text-xs mt-0.5 flex-shrink-0">04</span>
            <div>
              Busca tu bot recién creado en Telegram y <span className="text-white font-500">escríbele cualquier mensaje</span> para activarlo
            </div>
          </div>
          <div className="flex items-start gap-3 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3">
            <span className="text-amber-400 font-mono text-xs mt-0.5 flex-shrink-0">05</span>
            <div className="w-full">
              <p className="mb-2">Abre esta URL en el navegador para obtener tu <span className="text-white font-500">chat_id</span>:</p>
              <div className="flex items-center gap-2 bg-[#0A0E1A] rounded-lg px-3 py-2">
                <code className="text-cyan-400 text-xs flex-1 break-all">
                  https://api.telegram.org/bot<span className="text-amber-400">TU_TOKEN</span>/getUpdates
                </code>
                <button onClick={() => copiar('https://api.telegram.org/bot<TU_TOKEN>/getUpdates', 'url')}
                  className="flex-shrink-0 text-slate-500 hover:text-slate-300">
                  {copiado === 'url' ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Busca el número en <code className="text-cyan-400">"id"</code> dentro de <code className="text-cyan-400">"chat"</code></p>
            </div>
          </div>
        </div>
      </div>

      {/* Paso 2 — Variables de entorno */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6 space-y-4">
        <h3 className="font-display font-700 text-white tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs flex items-center justify-center font-mono">2</span>
          Agregar al archivo .env.local
        </h3>
        <div className="relative bg-[#0A0E1A] border border-[#1E2A3A] rounded-xl p-4">
          <button
            onClick={() => copiar('TELEGRAM_BOT_TOKEN=tu_token_aqui\nTELEGRAM_CHAT_ID=tu_chat_id_aqui\nCRON_SECRET=una_clave_secreta_cualquiera\nNEXT_PUBLIC_APP_URL=https://tu-app.vercel.app', 'env')}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {copiado === 'env' ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
          <pre className="font-mono text-xs text-slate-300 leading-relaxed">
{`TELEGRAM_BOT_TOKEN=`}<span className="text-amber-400">tu_token_aqui</span>{`
TELEGRAM_CHAT_ID=`}<span className="text-amber-400">tu_chat_id_aqui</span>{`
CRON_SECRET=`}<span className="text-amber-400">una_clave_secreta_cualquiera</span>{`
NEXT_PUBLIC_APP_URL=`}<span className="text-amber-400">https://tu-app.vercel.app</span>
          </pre>
        </div>
        <p className="text-xs text-slate-500">En Vercel también agrégalas en Settings → Environment Variables</p>
      </div>

      {/* Paso 3 — Hora del cron */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6 space-y-4">
        <h3 className="font-display font-700 text-white tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs flex items-center justify-center font-mono">3</span>
          Elegir hora de la alerta diaria
        </h3>
        <div className="space-y-2">
          {HORAS_PRESET.map(h => (
            <button
              key={h.cron}
              onClick={() => setHoraSeleccionada(h.cron)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm ${
                horaSeleccionada === h.cron
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'border-[#1E2A3A] text-slate-400 hover:border-slate-600'
              }`}
            >
              <span className="font-mono">{h.label}</span>
              {horaSeleccionada === h.cron && <Check size={14} />}
            </button>
          ))}
        </div>

        <div className="bg-[#0A0E1A] border border-[#1E2A3A] rounded-xl p-4 space-y-2">
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">Contenido de vercel.json</p>
          <div className="relative">
            <button
              onClick={() => copiar(`{\n  "crons": [\n    {\n      "path": "/api/cron",\n      "schedule": "${horaSeleccionada}"\n    }\n  ]\n}`, 'vercel')}
              className="absolute top-0 right-0 text-slate-500 hover:text-slate-300"
            >
              {copiado === 'vercel' ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
            <pre className="font-mono text-xs text-cyan-400 leading-relaxed">
{`{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "`}<span className="text-amber-400">{horaSeleccionada}</span>{`"
    }
  ]
}`}
            </pre>
          </div>
          <p className="text-xs text-slate-600">Hora en UTC — Chile es UTC-3 en verano y UTC-4 en invierno</p>
        </div>
      </div>

      {/* Paso 4 — Probar */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6 space-y-4">
        <h3 className="font-display font-700 text-white tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs flex items-center justify-center font-mono">4</span>
          Probar alerta ahora
        </h3>
        <p className="text-sm text-slate-400">
          Envía una alerta de prueba al instante con los eventos pendientes actuales.
          Asegúrate de haber completado los pasos anteriores primero.
        </p>

        {resultado && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
            resultado.ok
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {resultado.ok
              ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            }
            {resultado.msg}
          </div>
        )}

        <button
          onClick={probarAlerta}
          disabled={probando}
          className="w-full py-3 rounded-xl font-display font-700 text-sm flex items-center justify-center gap-2 tracking-wider btn-primary"
        >
          {probando
            ? <><Loader2 size={16} className="spin-slow" /> Enviando...</>
            : <><Send size={16} /> ENVIAR ALERTA DE PRUEBA</>
          }
        </button>
      </div>

    </div>
  );
}
