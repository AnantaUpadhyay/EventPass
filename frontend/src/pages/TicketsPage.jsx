import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Ticket, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { PageTitle, ErrorMessage, Empty, Loading } from "../components/UI";
import TicketCard from "../components/TicketCard";
export default function TicketsPage({ onDiscover }) {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/booking/mine", { token });
      setBookings(data.bookings);
      const mail = await api("/api/notifications/mine", { token }).catch(
        () => ({ notifications: [] }),
      );
      setNotifications(mail.notifications);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageTitle
        eyebrow="YOUR RESERVATIONS"
        title="My tickets"
        description="Booking details, admission codes, and email delivery."
        action={
          <button className="button outline small" onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      <ErrorMessage>{error}</ErrorMessage>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : bookings.length ? (
        <div className="tickets-grid">
          {bookings.map((b) => (
            <div key={b.bookingId}>
              <TicketCard booking={b} />
              <div className="delivery-status">
                <span
                  className={`status-dot ${notifications.find((n) => n.bookingId === b.bookingId)?.status === "SENT" ? "" : "pending"}`}
                />
                {notifications.find((n) => n.bookingId === b.bookingId)
                  ?.status === "SENT"
                  ? "Ticket email sent"
                  : "Ticket email queued · worker retries automatically"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !error && (
          <Empty title="No tickets yet." icon={Ticket}>
            Browse the calendar and choose an event.
            <br />
            <button className="button primary" onClick={onDiscover}>
              Explore experiences <ArrowUpRight size={17} />
            </button>
          </Empty>
        )
      )}
    </div>
  );
}
