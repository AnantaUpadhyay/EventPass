import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  MapPin,
  ArrowRight,
  X,
} from "lucide-react";
import { api, money } from "../api";
import { ErrorMessage, Empty } from "../components/UI";
import CityDiscovery from "../components/CityDiscovery";
const categories = [
  ["All", "All experiences"],
  ["Concert", "Music & nightlife"],
  ["Tech & Hackathon", "Tech & hackathons"],
  ["Workshop", "Workshops"],
  ["Sports & Gaming", "Sports & gaming"],
  ["Conference", "Conferences"],
];
export default function CatalogPage({ onSelectEvent, onSignIn }) {
  const [events, setEvents] = useState([]);
  const [spotlight, setSpotlight] = useState(null);
  useEffect(() => {
    api("/api/catalog/events/evt_neon_nights_2026")
      .then((data) => setSpotlight(data.event))
      .catch(() => {});
  }, []);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("date");
  const [free, setFree] = useState(false);
  const [filters, setFilters] = useState(false);
  const [retry, setRetry] = useState(0);
  const section = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api(
          `/api/catalog/events?${new URLSearchParams({ category, search })}`,
          { signal: controller.signal },
        );
        setEvents(data.events);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [category, search, retry]);
  const featured = spotlight;
  const filtered = events
    .filter((e) => !free || e.price === 0)
    .sort((a, b) =>
      sort === "price" ? a.price - b.price : a.date.localeCompare(b.date),
    );
  return (
    <div className="catalog-page">
      <div className="intro-line">
        <span className="eyebrow">
          <span className="journal-line" /> EVENTS & EXPERIENCES
        </span>
        <span className="campus-label">
          <span className="status-dot" /> Music · Culture · Live events
        </span>
      </div>
      <div className="editorial-heading">
        <h1>
          Discover what’s next. <br />
          Worth <span className="serif-word">being there.</span>
        </h1>
        <p>
          Live music, films, and good company. <br />A few things worth making
          time for. <br />
          <span>Find a plan worth showing up for.</span>
        </p>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill translucent">FEATURED / MUSIC</span>
          <p className="hero-kicker">FRIDAY 20 NOVEMBER · 18:00</p>
          <h2>
            An evening
            <br />
            out of the <span>ordinary.</span>
          </h2>
          <p>
            Live sets under an open sky.
            <br />
            Neon Nights returns to the amphitheatre.
          </p>
          <button
            className="button lime"
            disabled={!featured}
            onClick={(e) =>
              featured && onSelectEvent(featured, e.currentTarget)
            }
          >
            View the event <ArrowUpRight size={18} />
          </button>
          <div className="hero-bottom">
            <span className="hero-date">
              20<span>NOV ‘26</span>
            </span>
            <span>
              Neon Nights
              <br />
              <b>Open Air Amphitheatre</b>
            </span>
            <span className="hero-small-star">↗</span>
          </div>
        </div>
        <div className="hero-image">
          <img
            src="/assets/eventpass-hero.jpg"
            alt="A crowd enjoying a concert under colourful stage lights"
          />
          <span className="image-grain" />
          <div className="hero-image-top">
            <span>NEON NIGHTS / CAMPUS NORTH</span>
            <ArrowUpRight size={24} />
          </div>
          <div className="hero-image-caption">
            <span>THE LIVE EDIT</span>
            <b>
              Music after
              <br />
              the last lecture.
            </b>
          </div>
          <div className="floating-ticket">
            <span>ADMIT ONE</span>
            <div>
              <span>
                EVENTPASS
                <br />
                <b>admit one.</b>
              </span>
              <span className="ticket-star">e.</span>
            </div>
            <div className="barcode" />
            <small>20 NOV 2026 / OPEN AIR AMPHITHEATRE</small>
          </div>
        </div>
      </section>
      <div className="discovery-strip">
        <span>
          <span className="strip-star">—</span> A considered selection, close to
          home.
        </span>
        <button
          onClick={() =>
            section.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
        >
          Browse the calendar <ArrowRight size={16} />
        </button>
      </div>
      <CityDiscovery onSignIn={onSignIn} />
      <section ref={section} className="events-section">
        <div className="section-top">
          <div>
            <span className="eyebrow">BOOK ON EVENTPASS</span>
            <h2>
              What’s <span className="serif-word">on.</span>
            </h2>
          </div>
          <span className="result-count">
            {loading ? "Loading events…" : `${filtered.length} upcoming events`}
          </span>
        </div>
        <div className="discovery-controls">
          <div
            className="category-tabs"
            role="group"
            aria-label="Event category"
          >
            {categories.map(([id, title]) => (
              <button
                key={id}
                className={category === id ? "active" : ""}
                onClick={() => setCategory(id)}
              >
                {title}
              </button>
            ))}
          </div>
          <div className="search-row">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Search experiences"
                placeholder="Search events or venues"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              className={`button outline small ${filters ? "filter-active" : ""}`}
              onClick={() => setFilters(!filters)}
              aria-expanded={filters}
            >
              <SlidersHorizontal size={16} /> Filters
              {free && <span className="filter-dot" />}
            </button>
          </div>
        </div>
        {filters && (
          <div className="filter-panel">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={free}
                onChange={(e) => setFree(e.target.checked)}
              />{" "}
              Free experiences only
            </label>
            <label className="sort-label">
              Sort by{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="date">Soonest first</option>
                <option value="price">Price: low to high</option>
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setFree(false);
                setSort("date");
                setSearch("");
                setCategory("All");
              }}
            >
              Reset
            </button>
          </div>
        )}
        <ErrorMessage>{error}</ErrorMessage>
        {error && (
          <button
            className="button outline small"
            onClick={() => setRetry(retry + 1)}
          >
            Try again
          </button>
        )}
        {loading ? (
          <div className="events-grid">
            {[1, 2, 3].map((i) => (
              <div className="event-skeleton" key={i}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : (
          !error &&
          (filtered.length ? (
            <div className="events-grid">
              {filtered.map((event, i) => (
                <EventCard
                  key={event._id}
                  event={event}
                  index={i}
                  onSelect={(e) => onSelectEvent(event, e.currentTarget)}
                />
              ))}
            </div>
          ) : (
            <Empty title="No events found">
              Try another category or a different search.
            </Empty>
          ))
        )}
      </section>
      <section className="manifesto">
        <span className="manifesto-star">e.</span>
        <div>
          <span className="eyebrow">OPEN INVITATION</span>
          <h2>
            Leave an evening
            <br />
            <span className="serif-word">unplanned.</span>
          </h2>
        </div>
        <span className="manifesto-small">
          SOMETHING TO LOOK FORWARD TO.
          <br />
          SOMEWHERE TO MEET.
        </span>
      </section>
    </div>
  );
}
function EventCard({ event, index, onSelect }) {
  const date = new Date(`${event.date}T12:00:00+05:30`);
  const isPast = new Date(`${event.date}T23:59:59+05:30`) < new Date();
  const soldOut = event.availableSeats === 0;
  return (
    <button
      className="event-card"
      onClick={onSelect}
      style={{ "--card-delay": `${index * 60}ms` }}
      disabled={isPast || soldOut}
    >
      <div
        className={`event-photo category-${event.category.split(" ")[0].toLowerCase()}`}
      >
        {(event.bannerUrl || !event.universityId) && <img
          src={event.bannerUrl || "/assets/eventpass-hackathon.jpg"}
          alt=""
          loading="lazy"
        />}
        <span className="category-badge">{event.category}</span>
        <span className="event-open">
          <ArrowUpRight size={21} />
        </span>
        <div className="date-block">
          <b>{date.getDate()}</b>
          <span>
            {date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
          </span>
        </div>
      </div>
      <div className="event-info">
        <div className="event-info-top">
          <span className="event-time">
            {date.toLocaleDateString("en-IN", { weekday: "short" })} ·{" "}
            {event.time}
          </span>
          <span className={`availability ${soldOut ? "sold" : ""}`}>
            <span />
            {isPast
              ? "Event ended"
              : soldOut
                ? "Sold out"
                : event.availableSeats === null
                  ? "Check seats"
                  : `${event.availableSeats} spots left`}
          </span>
        </div>
        <h3>{event.title}</h3>
        <p className="event-venue">
          <MapPin size={14} />
          {event.venue}
        </p>
        <div className="event-card-bottom">
          <span>
            {money(event.price)}
            <small>{event.price > 0 ? " / person" : " / open to all"}</small>
          </span>
          <span className="card-action">
            View event <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </button>
  );
}
