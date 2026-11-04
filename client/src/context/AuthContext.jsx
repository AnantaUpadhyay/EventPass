import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let current = true;
    api('/api/auth/me', { token }).then(data => { if (current) setUser(data.user); }).catch(err => { if (current && err.status === 401) logout(); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token]);
  function save(data) { setUser(data.user); setToken(data.token);  }
  async function login(email, password) { const data = await api('/api/auth/login', { method: 'POST', body: { email, password } }); save(data); }
  async function register(name, email, password) { const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } }); save(data); }
  function logout() { setUser(null); setToken(null); localStorage.removeItem('ep_token'); localStorage.removeItem('ep_user'); }
  return <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
