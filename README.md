# ☀️ Bitácora Solar

Sistema de bitácora digital para operadores de plantas fotovoltaicas. Reemplaza el Excel por una interfaz moderna y fácil de usar, con mejora de redacción por IA.

## Stack
- **Next.js 14** — Framework web
- **Firebase Firestore** — Base de datos en la nube (gratuita)
- **Groq API** — IA para mejorar redacción (gratuita, 14.400 req/día)

---

## 🚀 Instalación paso a paso

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Firebase (GRATIS)

1. Ve a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto (ej: `bitacora-solar`)
3. En el panel, haz click en **"Web"** (ícono `</>`) para agregar una app
4. Copia las credenciales que aparecen
5. Ve a **Firestore Database** → **Crear base de datos** → Modo producción → Elige tu región

**Reglas de seguridad básicas para Firestore:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bitacora/{document=**} {
      allow read, write: if true; // Cambia esto si agregas autenticación
    }
  }
}
```

### 3. Configurar Groq API (GRATIS)

1. Ve a [https://console.groq.com](https://console.groq.com)
2. Crea una cuenta gratuita
3. Ve a **API Keys** → **Create API Key**
4. Copia tu API key

### 4. Crear archivo .env.local

Copia `.env.example` a `.env.local` y completa tus credenciales:
```bash
cp .env.example .env.local
```
Luego edita `.env.local` con tus valores reales.

### 5. Correr en desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000)

### 6. Build para producción
```bash
npm run build
npm start
```

---

## 🌐 Deploy gratuito en Vercel

1. Sube el proyecto a GitHub
2. Ve a [vercel.com](https://vercel.com) → Import Project
3. En **Environment Variables**, agrega todas las variables de `.env.local`
4. Deploy!

---

## 📋 Personalizar plantas

Edita el archivo `src/lib/types.ts` para cambiar los nombres de tus plantas:

```typescript
export const PLANTAS = [
  'Mi Planta Solar 1',
  'Mi Planta Solar 2',
  // agrega las tuyas
];
```

---

## 🔧 Características
- ✅ Registro rápido con formulario
- ✅ Cards con toda la información del evento
- ✅ Cálculo automático de duración del evento
- ✅ Mejora de redacción con IA (3 campos)
- ✅ Búsqueda en tiempo real
- ✅ Contador de eventos del día
- ✅ Datos guardados en la nube (Firebase)
- ✅ Diseño industrial/solar profesional
