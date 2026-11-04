import React, { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, eventDate } from "../api";
import { ErrorMessage, Loading } from "./UI";

export default function CityDiscovery({ onSignIn }) {
  const { token } = useAuth();
  const [options, setOptions] = useState({ cities: [], categories: [] });
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("All");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api("/api/catalog/discovery/options", { signal: controller.signal })
      .then(setOptions)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setResult(null);
    setError("");
    if (!city || !token) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api(
      `/api/catalog/discovery?${new URLSearchParams({ city, category, q: query })}`,
      {
        token,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
      },
    )
      .then(setResult)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.name === "TimeoutError"
              ? "This search took too long. Please try again."
              : err.message,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [city, category, query, token, retry]);
  const suggestions = result?.searchSuggestions;
  return (
    <section className="city-discovery" aria-labelledby="city-discovery-title">
      <div className="city-discovery-heading">
        <div>
          <span className="eyebrow">BEYOND EVENTPASS</span>
          <h2 id="city-discovery-title">Find your city’s next big thing.</h2>
          <p>
            Concerts, college festivals, cinema and more. Find a plan, then book
            with its provider.
          </p>
        </div>
        <label className="city-picker">
          <MapPin size={18} />
          <span className="sr-only">Choose your city</span>
          <select
            aria-label="Choose your city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!options.cities.length}
          >
            <option value="">Choose your city</option>
            {options.cities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <form
        className="city-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() === query) setRetry((value) => value + 1);
          else setQuery(draft.trim());
        }}
      >
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="Find third-party events"
            placeholder="An event, artist, film or college"
            maxLength={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <select
          aria-label="Type of experience"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {options.categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button className="button primary" disabled={!city || loading}>
          Find events <ArrowUpRight size={16} />
        </button>
      </form>
      {!city && !error && (
        <p className="city-message">
          Choose a city to discover upcoming events, or search for something you
          already have in mind.
        </p>
      )}
      {city && !token && (
        <div className="city-sign-in">
          <p>Sign in to discover upcoming events in {city}.</p>
          <button className="button outline small" onClick={onSignIn}>
            Sign in <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      <div aria-live="polite" aria-busy={loading}>
        {loading && <Loading label={`Finding sourced listings in ${city}…`} />}
        <ErrorMessage>{error}</ErrorMessage>
        {error && city && token && (
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        )}
        {result && (
          <>
            <div className="city-results-meta">
              <span>
                {result.events.length} sourced{" "}
                {result.events.length === 1 ? "listing" : "listings"} ·{" "}
                {result.city}
              </span>
              <span>
                Checked{" "}
                {new Date(result.checkedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {result.events.length ? (
              <div className="city-events-grid">
                {result.events.map((event) => (
                  <article className="city-event" key={event.url}>
                    <span className="city-category">{event.category}</span>
                    <h3>{event.title}</h3>
                    <p>
                      <CalendarDays size={15} />
                      {eventDate(event.date)}
                    </p>
                    <p>
                      <MapPin size={15} />
                      {event.venue}
                    </p>
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>View on {event.provider}</span>
                      <ArrowUpRight size={17} />
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <p className="city-message">
                No upcoming listings could be confirmed for this search. Try
                another city, category or name.
              </p>
            )}
            <p className="city-provider-note">
              Third-party bookings take place on the provider’s website. Confirm
              the date, price and availability there.
            </p>
            {suggestions && (
              <iframe
                className="city-search-suggestions"
                title="Related Google searches"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={`<!doctype html><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; script-src 'none'; base-uri 'none'; form-action 'none'"><base target="_blank">${suggestions}`}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
