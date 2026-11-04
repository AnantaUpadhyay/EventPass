import React, { useEffect, useState } from "react";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { api, eventDate } from "../api";
import { useAuth } from "../context/AuthContext";
import { PageTitle, ErrorMessage } from "../components/UI";
import CampusEventImage from "../components/CampusEventImage";
import EventReviews from "../components/EventReviews";
export default function UniversityPage({ onSelectEvent, onSignIn }) {
  const { user, token, requestOrganizer } = useAuth();
  const [options, setOptions] = useState({ universities: [] });
  const [universityId, setUniversityId] = useState("");
  const [search, setSearch] = useState("");
  const [upcoming, setUpcoming] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState("");
  const [approvalNotice, setApprovalNotice] = useState("");
  useEffect(() => { api("/api/catalog/universities").then(setOptions).catch(err => setError(err.message)); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      api(`/api/catalog/campus/events?${new URLSearchParams({ universityId, search, upcoming: String(upcoming) })}`, { signal: controller.signal })
        .then(data => setEvents(data.events))
        .catch(err => { if (!controller.signal.aborted) setError(err.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [universityId, search, upcoming]);
  useEffect(() => {
    if (user?.role === "admin") api("/api/auth/organizer-requests", { token }).then(data => setRequests(data.users)).catch(err => setError(err.message));
  }, [user?.role, token]);
  async function approve(id) {
    setBusy(id); setError("");
    try {
      await api(`/api/auth/organizer-requests/${id}/approve`, { token, method: "PATCH" });
      setRequests(current => current.filter(item => item.id !== id));
      setApprovalNotice("Organizer approved. They must sign out and sign in again before publishing.");
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  const universityGroups = options.universities.map(university => ({
    ...university, events: events.filter(event => event.universityId === university.id),
  })).filter(university => university.events.length);
  return <div className="university-page">
    <PageTitle eyebrow="EVENTPASS / CAMPUS NETWORK" title="Across Indian campuses." description="Fests, hackathons and academic events across Indian campuses. All students can explore every university’s events." />
    <section className="university-toolbar" aria-label="University event filters">
      <label>University<select value={universityId} onChange={e => setUniversityId(e.target.value)}><option value="">All universities</option>{options.universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>Search<input type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={120} placeholder="Fest, university or event" /></label>
      <label className="campus-checkbox"><input type="checkbox" checked={upcoming} onChange={e => setUpcoming(e.target.checked)} />Source-dated upcoming events only</label>
      {user?.universityId && <button className="text-button" onClick={() => setUniversityId(user.universityId)}>My university</button>}
    </section>
    <p className="campus-source-note">Research checked 4 November 2026. Dates unconfirmed means a recurring series, not an announced upcoming edition. Source pages control registration and entry rules.</p>
    {user?.role === "student" && !user.organizerRequested && <section className="campus-pending">
      <p>Organizing a university event? Request publishing access for your campus.</p>
      <button className="button outline small" disabled={Boolean(busy)} onClick={async () => {
        setBusy("request"); setError("");
        try { await requestOrganizer(); } catch (err) { setError(err.message); } finally { setBusy(""); }
      }}>{busy === "request" ? "Requesting…" : "Request organizer access"}</button>
    </section>}
    {user?.organizerRequested && <p className="campus-pending" role="status">Your organizer request awaits admin review. Publishing access is enabled only after approval and a new sign-in.</p>}
    {user?.role === "admin" && <section className="organizer-requests">
      <h2>University organizer requests</h2><p>Verify the applicant’s university authority independently before granting publishing access.</p>
      {requests.length === 0 && <p>No pending requests.</p>}
      {requests.map(person => <div className="organizer-request" key={person.id}><span><strong>{person.name}</strong><br />{person.email}<br />{options.universities.find(u => u.id === person.universityId)?.name}</span><button className="button outline small" disabled={Boolean(busy)} onClick={() => approve(person.id)}>{busy === person.id ? "Approving…" : "Approve organizer"}</button></div>)}
      {approvalNotice && <p role="status">{approvalNotice}</p>}
    </section>}
    <ErrorMessage>{error}</ErrorMessage>
    {loading ? <p role="status">Loading campus events…</p> : <>
      <p className="campus-count">{events.length} {events.length === 1 ? "listing" : "listings"}</p>
      {events.length === 0 && <p>No listings match these filters. Dates are added only when supported by a source or an approved organizer.</p>}
      {universityGroups.map(group => <section className="university-event-group" key={group.id} aria-label={`${group.name} events`}>
        <header className="university-group-heading"><div><span className="eyebrow">{group.city}</span><h2>{group.name}</h2></div><span>{group.events.length} {group.events.length === 1 ? "event" : "events"}</span></header>
        <div className="campus-event-grid">{group.events.map(event => <article className="campus-event" key={event._id}>
        <CampusEventImage event={event} />
        <div className="campus-event-top"><span><GraduationCap size={17} />{event.university?.shortName}</span><span>{event.academicTrack}</span></div>
        <span className={`campus-date-status ${event.status === "Upcoming" ? "upcoming" : ""}`}>{event.status}</span>
        <h3>{event.title}</h3>
        <p className="campus-event-date">{event.date ? `${eventDate(event.date)}${event.endDate ? ' – ' + eventDate(event.endDate) : ''}` : "Next-edition dates not confirmed"}</p>
        <p>{event.description}</p>
        <p className="campus-form-note">{event.external ? `${event.kind} · Source-backed directory` : `Published by an approved university organizer · ${event.venue}`}</p>
        {event.external ? <a className="button outline small" href={event.sourceUrl} target="_blank" rel="noopener noreferrer">Official / organizer source <ArrowUpRight size={15} /></a> : <button className="button primary small" disabled={event.status !== "Upcoming"} onClick={() => onSelectEvent(event)}>Choose seats <ArrowUpRight size={15} /></button>}
        <EventReviews eventId={event._id} onSignIn={onSignIn} />
      </article>)}</div>
      </section>)}
    </>}
  </div>;
}
