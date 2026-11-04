import React, { useState } from "react";
import {
  Compass,
  Ticket,
  Activity,
  ArrowUpRight,
  LogOut,
  Moon,
  Sun,
  Plus,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Brand, Modal } from "./components/UI";
import AuthPage from "./pages/AuthPage";
import CatalogPage from "./pages/CatalogPage";
import BookingPage from "./pages/BookingPage";
import TicketsPage from "./pages/TicketsPage";
import DashboardPage from "./pages/DashboardPage";
import CreateEventPage from "./pages/CreateEventPage";
import { api } from "./api";
import { changeView } from "./motion";
function AppContent() {
  const { user, loading, logout } = useAuth();
  const [page, setPage] = useState("discover");
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem("ep_theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ep_theme", theme);
  }, [theme]);
  const [event, setEvent] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [deepLinkError, setDeepLinkError] = useState("");
  const deepLinkHandled = React.useRef(false);
  React.useEffect(() => {
    if (loading || deepLinkHandled.current) return;
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    deepLinkHandled.current = true;
    api(`/api/catalog/events/${encodeURIComponent(id)}`)
      .then(({ event: linked }) => {
        if (user) {
          setEvent(linked);
          setPage("booking");
        } else {
          setPendingEvent(linked);
          setAuthOpen(true);
        }
      })
      .catch((err) => setDeepLinkError(err.message));
  }, [loading, user]);
  const closeAuth = React.useCallback(() => {
    setAuthOpen(false);
    setPendingEvent(null);
  }, []);
  React.useEffect(() => {
    if (user) {
      setAuthOpen(false);
      if (pendingEvent) {
        setEvent(pendingEvent);
        setPage("booking");
        setPendingEvent(null);
      }
    }
  }, [user, pendingEvent]);
  const go = (next) =>
    changeView(() => {
      setPage(next);
      setEvent(null);
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  const select = (e, origin) => {
    if (!user) {
      setPendingEvent(e);
      setAuthOpen(true);
      return;
    }
    const artwork =
      origin?.querySelector("img") ||
      origin?.closest(".hero")?.querySelector(".hero-image > img");
    if (artwork) artwork.style.viewTransitionName = "event-art";
    changeView(() => {
      setEvent(e);
      setPage("booking");
      window.scrollTo(0, 0);
    });
  };
  const nav = [
    ["discover", Compass, "Discover"],
    ["tickets", Ticket, "My tickets"],
    ...(user?.role === "admin" ? [["create", Plus, "Create event"]] : []),
    ["system", Activity, "System overview"],
  ];
  return (
    <div className="app-shell">
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="brand-button"
              onClick={() => go("discover")}
              aria-label="EventPass home"
            >
              <Brand />
            </button>
            <nav className="desktop-nav" aria-label="EventPass navigation">
              {nav.map(([id, Icon, label]) => (
                <button
                  key={id}
                  className={page === id ? "selected" : ""}
                  onClick={() => go(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <span className="breadcrumb">
              EventPass <span>/</span>{" "}
              <b>
                {page === "booking"
                  ? "Your next experience"
                  : nav.find((n) => n[0] === page)?.[2] || "Create event"}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button theme-toggle"
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {loading ? (
              <span className="spinner" />
            ) : user ? (
              <>
                <span className="avatar">{user.name.slice(0, 1)}</span>
                <span className="user-name">{user.name.split(" ")[0]}</span>
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={() => {
                    logout();
                    go("discover");
                  }}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button
                className="button dark small"
                onClick={() => setAuthOpen(true)}
              >
                Sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main id="main" className="main-content" key={page}>
          {deepLinkError && (
            <div className="error-message" role="alert">
              {deepLinkError}
            </div>
          )}
          {page === "discover" && (
            <CatalogPage
              onSelectEvent={select}
              onSignIn={() => setAuthOpen(true)}
            />
          )}
          {page === "booking" && event && (
            <BookingPage
              event={event}
              onBack={() => go("discover")}
              onBooked={() => go("tickets")}
            />
          )}
          {page === "tickets" &&
            (user ? (
              <TicketsPage onDiscover={() => go("discover")} />
            ) : (
              <Guest
                title="Keep your plans together."
                onSignIn={() => setAuthOpen(true)}
              />
            ))}
          {page === "system" && <DashboardPage />}
          {page === "create" && user?.role === "admin" && (
            <CreateEventPage onCreated={() => go("discover")} />
          )}
        </main>
        <footer className="main-footer">
          <Brand />
          <span>Great events. Good company.</span>
          <span>Discover. Book. Be there.</span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {nav.map(([id, Icon, label]) => (
          <button
            key={id}
            className={page === id ? "selected" : ""}
            onClick={() => go(id)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
      {authOpen && (
        <Modal title="WELCOME TO EVENTPASS" onClose={closeAuth}>
          <AuthPage />
        </Modal>
      )}
    </div>
  );
}
function Guest({ title, onSignIn }) {
  return (
    <div className="guest-page">
      <span className="eyebrow">YOUR EVENTPASS</span>
      <h1>{title}</h1>
      <p>Sign in to manage your event reservations and tickets.</p>
      <button className="button primary" onClick={onSignIn}>
        Sign in <ArrowUpRight size={18} />
      </button>
    </div>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
