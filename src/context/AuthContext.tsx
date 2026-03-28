'use client';
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { obtenerPerfil } from '@/lib/usuarios';
import { Usuario } from '@/lib/types';

interface AuthContextType {
  usuario: Usuario | null;
  cargandoAuth: boolean;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  cargandoAuth: true,
  cerrarSesion: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const perfil = await obtenerPerfil(firebaseUser.uid);
        if (perfil) {
          setUsuario(perfil);
        } else {
          // Usuario autenticado sin perfil (fue eliminado) → cerrar sesión
          await signOut(auth);
          setUsuario(null);
        }
      } else {
        setUsuario(null);
      }
      setCargandoAuth(false);
    });
    return unsub;
  }, []);

  const cerrarSesion = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargandoAuth, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
