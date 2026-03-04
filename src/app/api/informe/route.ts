// src/app/api/informe/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { registros, fechaDesde, fechaHasta } = await req.json();

  if (!registros || registros.length === 0) {
    return NextResponse.json({ error: 'No hay registros para el período' }, { status: 400 });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 500 });
  }

  // Construir resumen de registros para el prompt
  const resumenRegistros = registros.map((r: {
    planta: string;
    acontecimiento: string;
    causa: string;
    detalle: string;
    fechaInicio: string;
    horaInicio: string;
    fechaFin: string;
    horaFin: string;
    estado?: string;
  }, i: number) => `
EVENTO ${i + 1}:
- Planta: ${r.planta}
- Acontecimiento: ${r.acontecimiento}
- Causa: ${r.causa}
- Detalle: ${r.detalle || 'Sin detalle'}
- Inicio: ${r.fechaInicio} ${r.horaInicio}
- Fin: ${r.fechaFin} ${r.horaFin}
- Estado: ${r.estado || 'pendiente'}
`).join('\n---\n');

  const prompt = `Eres un asistente técnico especializado en plantas fotovoltaicas (solares). 
Se te entrega el registro de eventos de una o más plantas entre el ${fechaDesde} y el ${fechaHasta}.

REGISTROS DEL PERÍODO:
${resumenRegistros}

Genera un INFORME OPERACIONAL PROFESIONAL en español con la siguiente estructura exacta:

# INFORME OPERACIONAL
**Período:** ${fechaDesde} al ${fechaHasta}
**Total de eventos:** [número]

## RESUMEN EJECUTIVO
[2-3 párrafos describiendo el comportamiento general del período, los eventos más relevantes y el estado operacional de las plantas]

## EVENTOS PENDIENTES
[Lista de todos los eventos con estado "pendiente", indicando planta, acontecimiento y tiempo transcurrido. Si no hay pendientes, indica "Sin eventos pendientes en el período."]

## EVENTOS RESUELTOS
[Lista resumida de eventos resueltos con su duración]

## ANÁLISIS Y PATRONES
[Identifica si hay equipos o plantas con fallas repetidas, horas críticas, causas recurrentes]

## RECOMENDACIONES
[2-3 recomendaciones técnicas concretas basadas en los eventos del período]

Usa lenguaje técnico profesional. Sé conciso pero completo. No inventes datos que no estén en los registros.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq error:', err);
      throw new Error('Error en Groq API');
    }

    const data = await response.json();
    const informe = data.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ informe });
  } catch (error) {
    console.error('Error informe:', error);
    return NextResponse.json({ error: 'Error al generar el informe' }, { status: 500 });
  }
}
