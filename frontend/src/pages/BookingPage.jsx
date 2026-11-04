import EventReviews from "../components/EventReviews";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  ShieldCheck,
  MapPin,
  CalendarDays,
  Check,
  Info,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, money, eventDate } from "../api";
import { ErrorMessage, Loading } from "../components/UI";
import TicketCard from "../components/TicketCard";
import { changeView } from "../motion";
export default function BookingPage({ event, onBack, onBooked }) {
  const { token } = useAuth();
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState([]);
  const [hold, setHold] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState(null);
  const activeHold = useRef(null);
  const confirmed = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    try {
      const data = await api(`/api/booking/seats/${event._id}`, { token });
      setMap(data);
      // Restore this user's live hold when returning to an event.
      if (!activeHold.current && !confirmed.current) {
        const mine = data.grid
          .flatMap((r) => r.seats)
          .filter((s) => s.mine && s.status === "HELD");
        if (mine.length) {
          const restored = {
            seatIds: mine.map((s) => s.seatId),
            expiresAt:
              Date.now() +
              Math.min(...mine.map((s) => s.remainingSeconds)) * 1000,
          };
          activeHold.current = restored;
          setHold(restored);
          setSelected(restored.seatIds);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }, [event._id, token]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!hold) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) {
        activeHold.current = null;
        setHold(null);
        setSelected([]);
        setError("Your hold expired. Choose a seat to start again.");
        load();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold, load]);
  // Redis owns hold lifetime: navigation and sign-out must not release another session's seats.
  const selectionUpdating = useRef(false);
  async function toggleSeat(seatId) {
    if (selectionUpdating.current) return;
    selectionUpdating.current = true;
    setBusy(true);
    setError("");
    try {
      const removing = selected.includes(seatId);
      const next = removing
        ? selected.filter((id) => id !== seatId)
        : [...selected, seatId];
      if (removing)
        await api("/api/booking/release", {
          method: "POST",
          token,
          body: { eventId: event._id, seatIds: [seatId] },
        });
      const data = next.length
        ? await api("/api/booking/hold", {
            method: "POST",
            token,
            body: { eventId: event._id, seatIds: next },
          })
        : null;
      activeHold.current = data;
      setHold(data);
      setSelected(data?.seatIds || []);
      requestId.current = crypto.randomUUID();
    } catch (err) {
      setError(err.message);
    } finally {
      selectionUpdating.current = false;
      setBusy(false);
      await load();
    }
  }
  async function release() {
    setBusy(true);
    setError("");
    try {
      await api("/api/booking/release", {
        method: "POST",
        token,
        body: { eventId: event._id, seatIds: hold.seatIds },
      });
      activeHold.current = null;
      setHold(null);
      setSelected([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/booking/confirm", {
        method: "POST",
        token,
        headers: { "Idempotency-Key": requestId.current },
        body: { eventId: event._id, seatIds: hold.seatIds },
      });
      confirmed.current = true;
      activeHold.current = null;
      changeView(() => {
        setHold(null);
        setBooking(data.booking);
        window.scrollTo(0, 0);
      });
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        activeHold.current = null;
        setHold(null);
        setSelected([]);
        load();
      }
    } finally {
      setBusy(false);
    }
  }
  if (booking)
    return (
      <div className="booking-success">
        <span className="success-seal">
          <Check size={32} />
        </span>
        <span className="eyebrow">RESERVATION CONFIRMED</span>
        <h1>
          See you <span className="serif-word">there.</span>
        </h1>
        <p>Your ticket is saved. Check My tickets for email delivery status.</p>
        <TicketCard booking={booking} />
        <button className="button primary" onClick={onBooked}>
          See all my tickets <ArrowUpRight size={18} />
        </button>
      </div>
    );
  return (
    <div className="booking-screen">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to experiences
      </button>
      <div className="booking-heading">
        <span className="eyebrow">RESERVATIONS</span>
        <h1>
          Choose your <span className="serif-word">seats.</span>
        </h1>
        <p>
          Select up to 10 seats. Each click holds your seats for up to ten
          minutes, including after sign-out.
        </p>
      </div>
      <div className="booking-layout">
        <section className="seat-panel">
          <div className="seat-panel-top">
            <h2>Seating plan</h2>
            <span className="live-indicator">
              <span className="status-dot" /> LIVE AVAILABILITY
            </span>
          </div>
          <p className="seat-scroll-hint">
            Swipe across the seating plan to see every seat.
          </p>
          <div
            className="seat-map-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable seating plan"
          >
            <div className="stage">
              <span>THE STAGE</span>
              <div />
            </div>
            {!map ? (
              <Loading label="Finding your front row…" />
            ) : (
              <div className="seat-grid" aria-label="Choose a seat">
                {map.grid.map((row) => (
                  <div className="seat-row" key={row.row}>
                    <span className="row-label">{row.row}</span>
                    {row.seats.map((seat, i) => (
                      <button
                        key={seat.seatId}
                        aria-label={`Seat ${seat.seatId}, ${seat.status.toLowerCase()}${seat.mine ? ", held by you" : ""}`}
                        aria-pressed={selected.includes(seat.seatId)}
                        disabled={
                          busy ||
                          seat.status === "BOOKED" ||
                          (seat.status === "HELD" && !seat.mine) ||
                          (selected.length >= 10 &&
                            !selected.includes(seat.seatId))
                        }
                        onClick={() => toggleSeat(seat.seatId)}
                        className={`seat ${selected.includes(seat.seatId) ? "selected" : seat.status.toLowerCase()} ${i === Math.floor(row.seats.length / 2) ? "aisle" : ""}`}
                      >
                        {selected.includes(seat.seatId) ? (
                          <Check size={16} />
                        ) : (
                          i + 1
                        )}
                      </button>
                    ))}
                    <span className="row-label">{row.row}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="seat-legend">
            <span>
              <i className="legend-available" /> Available
            </span>
            <span>
              <i className="legend-selected" /> Your selection
            </span>
            <span>
              <i className="legend-held" /> On hold
            </span>
            <span>
              <i className="legend-booked" /> Booked
            </span>
          </div>
          <div className="seat-note">
            <ShieldCheck size={18} />
            <span>
              A little time to decide.
              <small>Held for 10 minutes while you finish checkout.</small>
            </span>
          </div>
        </section>
        <aside className="order-panel">
          {event.bannerUrl && <img src={event.bannerUrl} alt="" className="order-cover" />}
          <div className="order-content">
            <span className="eyebrow">EVENT DETAILS</span>
            <h2>{event.title}</h2>
            <div className="order-meta">
              <span>
                <CalendarDays size={15} />
                {eventDate(event.date)} · {event.time}
              </span>
              <span>
                <MapPin size={15} />
                {event.venue}
              </span>
            </div>
            <p className="event-description">{event.description}</p>
            <div className="order-row">
              <span>Seat</span>
              <b>
                {selected.length ? selected.join(", ") : "Choose your seats"}
              </b>
            </div>
            <div className="order-row">
              <span>Tickets × {selected.length || 0}</span>
              <b>
                {money((Math.round(event.price * 100) * selected.length) / 100)}
              </b>
            </div>
            <div className="order-row">
              <span>Booking fee</span>
              <b>On us</b>
            </div>
            <div className="order-total">
              <span>Total</span>
              <b>
                {money((Math.round(event.price * 100) * selected.length) / 100)}
              </b>
            </div>
            {hold && (
              <div
                className={`hold-countdown ${remaining < 60 ? "urgent" : ""}`}
              >
                <Clock3 size={18} />
                <span>Seats held for</span>
                <b>
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </b>
              </div>
            )}
            <ErrorMessage>{error}</ErrorMessage>
            {hold ? (
              <>
                <button
                  className="button primary full"
                  disabled={busy || remaining === 0}
                  onClick={confirm}
                >
                  {busy ? "Confirming reservation…" : "Confirm my ticket"}
                  <ArrowUpRight size={18} />
                </button>
                <button
                  className="text-button release-button"
                  disabled={busy}
                  onClick={release}
                >
                  Release all selected seats
                </button>
              </>
            ) : (
              <button className="button primary full" disabled>
                {busy ? "Reserving seats…" : "Select seats above"}
                <ArrowUpRight size={18} />
              </button>
            )}
            <p className="checkout-note">
              <Info size={13} /> Demo checkout. No payment collected.
            </p>
          </div>
        </aside>
      </div>
      <EventReviews eventId={event._id} />
    </div>
  );
}
