import React, { useState } from "react";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ErrorMessage } from "../components/UI";
export default function AuthPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (tab === "login") await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-content">
      <img
        className="auth-logo"
        src="/assets/eventpass-ticket-logo-small.png"
        width="68"
        height="68"
        alt="EventPass emblem"
      />
      <h2>{tab === "login" ? "Welcome back." : "Join EventPass."}</h2>
      <p>Your events and tickets, in one place.</p>
      <div className="segmented">
        <button
          className={tab === "login" ? "selected" : ""}
          onClick={() => {
            setTab("login");
            setError("");
          }}
        >
          Sign in
        </button>
        <button
          className={tab === "register" ? "selected" : ""}
          onClick={() => {
            setTab("register");
            setError("");
          }}
        >
          Create account
        </button>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <form onSubmit={submit}>
        {tab === "register" && (
          <label>
            Full name
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@college.edu"
          />
        </label>
        <label>
          Password
          <span className="password-input">
            <input
              type={visible ? "text" : "password"}
              autoComplete={
                tab === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={tab === "register" ? 8 : 1}
              required
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              className="icon-button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button disabled={busy} className="button primary full">
          {busy
            ? "Signing in…"
            : tab === "login"
              ? "Sign in"
              : "Create your account"}
          <ArrowUpRight size={18} />
        </button>
      </form>
      {import.meta.env.DEV && (
        <div className="demo-access">
          <span>HERE FOR THE LAB DEMO?</span>
          <button
            disabled={busy}
            onClick={() => {
              setEmail("student@college.edu");
              setPassword("student123");
            }}
          >
            Use student credentials <ArrowUpRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
