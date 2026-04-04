'use client';
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { obtenerPerfil } from '@/lib/usuarios';
import { Usuario } from '@/lib/types';

interface AuthContextType {
  usuario: Usuario | null;
  cargandoAuth: boolean;
  cerrarSesion: () => Promise<void>;
  entrarComoInvitado: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  cargandoAuth: true,
  cerrarSesion: async () => {},
  entrarComoInvitado: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [esInvitado, setEsInvitado] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (esInvitado) return; // modo invitado activo, ignorar cambios de Firebase
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
  }, [esInvitado]);

  const cerrarSesion = async () => {
    if (esInvitado) {
      setEsInvitado(false);
      setUsuario(null);
    }
    await signOut(auth);
  };

  const entrarComoInvitado = async () => {
    setEsInvitado(true);
    setCargandoAuth(true);
    try {
      await signInAnonymously(auth);
      setUsuario({ uid: 'invitado', username: 'invitado', nombre: 'Invitado', rol: 'invitado' });
    } catch {
      setEsInvitado(false);
    } finally {
      setCargandoAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, cargandoAuth, cerrarSesion, entrarComoInvitado }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
