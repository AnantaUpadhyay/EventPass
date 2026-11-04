import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [guestTheme, setGuestTheme] = useState(() => {
    try { return localStorage.getItem("ep_guest_theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const theme = user ? (user.theme === "light" ? "light" : "dark") : guestTheme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#000000" : "#f4f1e9");
  }, [theme]);
  async function setTheme(nextTheme) {
    if (themeSaving) return;
    setThemeError("");
    if (!token) {
      setGuestTheme(nextTheme);
      try { localStorage.setItem("ep_guest_theme", nextTheme); } catch {}
      return;
    }
    setThemeSaving(true);
    try {
      const data = await api("/api/auth/me/preferences", {
        token, method: "PATCH", body: { theme: nextTheme },
      });
      setUser(current => current?.id === data.user.id ? data.user : current);
    } catch (err) {
      setThemeError("Could not save your appearance preference. Please try again.");
    } finally { setThemeSaving(false); }
  }
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let current = true;
    api("/api/auth/me", { token })
      .then((data) => {
        if (current) setUser(data.user);
      })
      .catch((err) => {
        if (current && err.status === 401) logout();
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token]);
  function save(data) {
    setThemeError("");
    setLoading(true);
    setUser(data.user);
    setToken(data.token);
  }
  async function login(email, password, universityId) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { email, password, universityId },
    });
    save(data);
  }
  async function register(name, email, password, universityId, organizerRequested = false) {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: { name, email, password, universityId, organizerRequested },
    });
    save(data);
  }
  async function requestOrganizer() {
    const data = await api("/api/auth/organizer-requests", { token, method: "POST" });
    setUser(current => current?.id === data.user.id ? data.user : current);
  }
  function logout() {
    setThemeError("");
    setUser(null);
    setToken(null);
    localStorage.removeItem("ep_token");
    localStorage.removeItem("ep_user");
  }
  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, theme, setTheme, themeSaving, themeError, requestOrganizer }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
