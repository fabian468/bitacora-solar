// src/app/api/telegram/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RegistroBitacora } from '@/lib/types';

async function obtenerPendientes(): Promise<RegistroBitacora[]> {
  const snap = await getDocs(collection(db, 'bitacora'));
  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroBitacora));
  return todos.filter(r => r.estado !== 'resuelto');
}

function calcDuracion(r: RegistroBitacora): string {
  try {
    const ini = new Date(`${r.fechaInicio}T${r.horaInicio}`);
    const fin = new Date();
    const diff = fin.getTime() - ini.getTime();
    if (diff <= 0) return '-';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return '-'; }
}

function formatDate(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

function construirMensaje(pendientes: RegistroBitacora[]): string {
  const ahora = new Date().toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  if (pendientes.length === 0) {
    return `☀️ *BITÁCORA SOLAR*\n📅 ${ahora}\n\n✅ *Sin eventos pendientes*\nTodas las plantas operan con normalidad.`;
  }

  const carbonFree = pendientes.filter(r => r.cliente === 'Carbon Free');
  const matrix = pendientes.filter(r => r.cliente === 'Matrix');

  let msg = `☀️ *BITÁCORA SOLAR — PENDIENTES*\n📅 ${ahora}\n`;
  msg += `⚠️ *${pendientes.length} evento${pendientes.length !== 1 ? 's' : ''} pendiente${pendientes.length !== 1 ? 's' : ''}*\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;

  if (carbonFree.length > 0) {
    msg += `\n🟢 *CARBON FREE* (${carbonFree.length})\n`;
    carbonFree.forEach((r, i) => {
      msg += `\n${i + 1}\\. 🏭 *${r.planta}*\n`;
      msg += `   📋 ${r.acontecimiento}\n`;
      msg += `   🔍 ${r.causa}\n`;
      msg += `   🕐 Desde: ${formatDate(r.fechaInicio)} ${r.horaInicio} \\(${calcDuracion(r)} hace\\)\n`;
    });
  }

  if (matrix.length > 0) {
    msg += `\n🔵 *MATRIX* (${matrix.length})\n`;
    matrix.forEach((r, i) => {
      msg += `\n${i + 1}\\. 🏭 *${r.planta}*\n`;
      msg += `   📋 ${r.acontecimiento}\n`;
      msg += `   🔍 ${r.causa}\n`;
      msg += `   🕐 Desde: ${formatDate(r.fechaInicio)} ${r.horaInicio} \\(${calcDuracion(r)} hace\\)\n`;
    });
  }

  msg += `\n━━━━━━━━━━━━━━━━\n`;
  msg += `_Bitácora Solar · Sistema de Registro Fotovoltaico_`;

  return msg;
}

async function enviarTelegram(mensaje: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados en .env.local');
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensaje,
      parse_mode: 'MarkdownV2',
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Error Telegram API');
  return true;
}

export async function POST(req: NextRequest) {
  // Verificar secret para el cron (evita que cualquiera lo llame)
  const { secret } = await req.json().catch(() => ({ secret: null }));
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const pendientes = await obtenerPendientes();
    const mensaje = construirMensaje(pendientes);
    await enviarTelegram(mensaje);
    return NextResponse.json({
      ok: true,
      pendientes: pendientes.length,
      mensaje: 'Alerta enviada correctamente'
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error Telegram:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET para probar desde el browser
export async function GET() {
  try {
    const pendientes = await obtenerPendientes();
    const mensaje = construirMensaje(pendientes);
    await enviarTelegram(mensaje);
    return NextResponse.json({
      ok: true,
      pendientes: pendientes.length,
      mensaje: 'Alerta enviada correctamente'
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
