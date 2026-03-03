// src/app/api/escanear/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { imagen, plantaDefault } = await req.json();

  if (!imagen) return NextResponse.json({ error: 'Sin imagen' }, { status: 400 });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY no configurada en .env.local' }, { status: 500 });
  }

  const prompt = `Analiza esta imagen de un cuaderno de bitácora de una planta fotovoltaica (solar).

  El cuaderno pertenece a una planta fotovoltaica. Vocabulario común: inversor, tracker, string, transformador, limitación de potencia, falla de comunicación...

Tu tarea es extraer TODOS los registros/acontecimientos escritos y estructurarlos en JSON.

Para cada registro encontrado, extrae:
- planta: nombre de la planta si aparece escrito, si no usa "${plantaDefault || 'Sin especificar'}"
- acontecimiento: título o descripción breve del evento
- causa: la causa o motivo del evento (si no aparece explícita, infiere del contexto o deja string vacío)
- detalle: cualquier observación, descripción adicional o notas
- fechaInicio: en formato YYYY-MM-DD (si no hay año usa ${new Date().getFullYear()}, si no hay fecha usa ${new Date().toISOString().split('T')[0]})
- horaInicio: en formato HH:MM en 24 horas. Si no aparece usa "00:00"
- fechaFin: en formato YYYY-MM-DD. Si no aparece usa la misma que fechaInicio
- horaFin: en formato HH:MM en 24 horas. Si no aparece usa "00:00"

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin bloques de código, sin explicaciones. Formato exacto:
{"registros":[{"planta":"...","acontecimiento":"...","causa":"...","detalle":"...","fechaInicio":"YYYY-MM-DD","horaInicio":"HH:MM","fechaFin":"YYYY-MM-DD","horaFin":"HH:MM"}],"nota":"observación opcional sobre legibilidad"}

Si no encuentras ningún registro devuelve: {"registros":[],"nota":"No se encontraron registros legibles"}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imagen, // Groq acepta base64 data URLs directamente
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq vision error:', err);
      return NextResponse.json(
        { error: 'Error al analizar imagen. Verifica que tu API key de Groq sea válida.' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    if (!text) {
      return NextResponse.json({ error: 'La IA no devolvió respuesta' }, { status: 500 });
    }

    // Limpiar posibles bloques de código markdown
    const clean = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Error escaneo:', error);
    return NextResponse.json(
      { error: 'Error al procesar la respuesta. Intenta con una imagen más clara.' },
      { status: 500 }
    );
  }
}
