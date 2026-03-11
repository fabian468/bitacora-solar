// src/app/api/cron/route.ts
// Este endpoint lo llama Vercel Cron Jobs automáticamente
// Configura en vercel.json la hora que quieras
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Vercel envía este header para autenticar el cron
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.CRON_SECRET }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
