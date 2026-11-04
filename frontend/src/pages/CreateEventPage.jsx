import React, { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { PageTitle, ErrorMessage } from "../components/UI";
export default function CreateEventPage({ onCreated }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Concert",
    venue: "",
    date: "",
    time: "18:00",
    price: "0",
    bannerUrl: "",
    rows: "5",
    seatsPerRow: "10",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/catalog/events", {
        token,
        method: "POST",
        body: {
          ...form,
          price: Number(form.price),
          seatLayout: {
            rows: Number(form.rows),
            seatsPerRow: Number(form.seatsPerRow),
          },
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageTitle
        eyebrow="EVENTPASS / ORGANIZER STUDIO"
        title="Create an event"
        description="Set the details, seating plan, and ticket price."
      />
      <section className="create-event-panel">
        <form onSubmit={submit}>
          <label>
            Event name
            <input
              name="title"
              value={form.title}
              onChange={change}
              required
              maxLength={120}
              placeholder="e.g. Campus Design Evening"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={change}
              required
              maxLength={3000}
              rows={4}
              placeholder="What should attendees know?"
            />
          </label>
          <div className="form-two">
            <label>
              Category
              <select name="category" value={form.category} onChange={change}>
                {[
                  "Concert",
                  "Tech & Hackathon",
                  "Workshop",
                  "Sports & Gaming",
                  "Conference",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Venue
              <input
                name="venue"
                value={form.venue}
                onChange={change}
                required
                maxLength={160}
                placeholder="Venue name or address"
              />
            </label>
          </div>
          <div className="form-two">
            <label>
              Date
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={change}
                min={new Date().toLocaleDateString("en-CA", {
                  timeZone: "Asia/Kolkata",
                })}
                required
              />
            </label>
            <label>
              Time · IST
              <input
                name="time"
                type="time"
                value={form.time}
                onChange={change}
                required
              />
            </label>
          </div>
          <div className="form-two">
            <label>
              Price per ticket · INR
              <input
                name="price"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={form.price}
                onChange={change}
                required
              />
            </label>
            <label>
              Banner image URL
              <input
                name="bannerUrl"
                type="url"
                value={form.bannerUrl}
                onChange={change}
                placeholder="https://…"
              />
            </label>
          </div>
          <div className="form-two">
            <label>
              Seat rows
              <input
                name="rows"
                type="number"
                min="1"
                max="20"
                value={form.rows}
                onChange={change}
                required
              />
            </label>
            <label>
              Seats per row
              <input
                name="seatsPerRow"
                type="number"
                min="1"
                max="20"
                value={form.seatsPerRow}
                onChange={change}
                required
              />
            </label>
          </div>
          <div className="create-capacity">
            <Sparkles size={18} />
            <span>
              Room for{" "}
              <b>{Number(form.rows) * Number(form.seatsPerRow)} seats.</b>
            </span>
          </div>
          <ErrorMessage>{error}</ErrorMessage>
          <button className="button primary" disabled={busy}>
            {busy ? "Creating event…" : "Publish event"}
            <ArrowUpRight size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
