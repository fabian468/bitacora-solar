# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos principales

```bash
npm run dev      # Servidor de desarrollo (http://localhost:3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
```

No hay comandos de test configurados. El linting usa la configuración por defecto de Next.js con ESLint.

## Variables de entorno requeridas

Copiar `.env.example` a `.env.local` y completar:

- `NEXT_PUBLIC_FIREBASE_*` — Credenciales de Firebase (Firestore)
- `GROQ_API_KEY` — API de Groq para mejora de texto e imagen (llama-3.1-8b-instant, llama-4-scout-17b-16e)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — Alertas de Telegram
- `CRON_SECRET` — Token de seguridad para el endpoint cron
- `NEXT_PUBLIC_APP_URL` — URL base de la app

## Arquitectura

**Stack**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Firebase Firestore + Groq API + Telegram Bot API. Deployado en Vercel con cron diario a las 6 AM (`/api/cron`).

### Capas

```
src/lib/          → Servicios y tipos
src/app/api/      → API Routes (server-side)
src/components/   → Componentes React (client-side)
src/app/page.tsx  → Dashboard principal
```

### Flujo de datos

- `src/lib/firebase.ts` inicializa la app de Firebase
- `src/lib/bitacora.ts`, `plantas.ts`, `despachos.ts` — CRUD sobre Firestore (colecciones: `bitacora`, `plantas`, `despachos`)
- `src/lib/types.ts` — todas las interfaces y constantes (`RegistroBitacora`, `Planta`, `Despacho`, `TIPOS_ACONTECIMIENTO`, `CLIENTES`)
- Los componentes en `src/components/` se montan desde `page.tsx` según la pestaña activa

### API Routes

| Ruta | Función |
|------|---------|
| `/api/mejorar` | Mejora texto técnico con Groq (acontecimiento, causa, detalle) |
| `/api/escanear` | OCR de fotos de cuaderno con visión Groq |
| `/api/telegram` | Envía alertas de eventos pendientes al chat de Telegram |
| `/api/cron` | Ejecutado por Vercel cron — llama a `/api/telegram` |
| `/api/informe` | Generación de informes |

### Clientes y plantas

Solo hay dos clientes fijos: `'Carbon Free'` y `'Matrix'` (definidos en `CLIENTES` en `types.ts`). Las plantas se crean dinámicamente por cliente.

## Diseño visual

Variables CSS personalizadas definidas en `globals.css`: `--solar-gold`, `--solar-dark`, `--solar-accent` (cyan), etc. El tema es industrial oscuro con acentos dorado/cyan. Las fuentes (Rajdhani, Inter, JetBrains Mono) se cargan desde Google Fonts en `layout.tsx`.

## Convenciones

- Todos los textos de UI están en español
- Componentes interactivos usan `'use client'`
- El estado global de la app vive en `page.tsx` (registros, plantas, despachos, filtros)
- Los API routes acceden a variables de entorno del servidor (sin prefijo `NEXT_PUBLIC_`)
