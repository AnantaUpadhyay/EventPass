import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { ErrorMessage } from "./UI";
export default function EventReviews({ eventId, onSignIn }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError("");
    api(`/api/catalog/events/${encodeURIComponent(eventId)}/reviews?page=${page}`, { signal: controller.signal })
      .then(setData).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [eventId, open, page, version]);
  async function save(e, remove = false) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/api/catalog/events/${encodeURIComponent(eventId)}/reviews`, {
        token, method: remove ? "DELETE" : "PUT", ...(remove ? {} : { body: { rating: Number(rating), comment } }),
      });
      setComment(""); setPage(1); setVersion(value => value + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="event-reviews">
    <button type="button" className="text-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? "Hide ratings & comments" : "Ratings & comments"}
      {data && ` · ${data.count ? data.average.toFixed(1) + '/5' : 'No ratings yet'} (${data.count})`}
    </button>
    {open && <div className="reviews-content">
      <p className="campus-form-note">Community opinions, not verified attendance. Festival-series reviews may refer to earlier editions.</p>
      <ErrorMessage>{error}</ErrorMessage>
      {!data && !error && <p role="status">Loading comments…</p>}
      {data?.reviews.map(review => <article className="review-item" key={review._id}>
        <div><strong>{review.userName}</strong><span>{review.rating}/5 · {new Date(review.updatedAt).toLocaleDateString("en-IN")}</span></div>
        <p>{review.comment || "Rated without a comment."}</p>
      </article>)}
      {data?.count === 0 && <p>No reviews yet. Share your experience.</p>}
      {data && data.count > 20 && <div className="review-pagination">
        <button type="button" className="button outline small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page}</span>
        <button type="button" className="button outline small" disabled={page * 20 >= data.count} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
      {user ? <form onSubmit={save} className="review-form">
        <label>Your rating<select aria-label="Your rating" value={rating} onChange={e => setRating(e.target.value)}>
          {[5,4,3,2,1].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}
        </select></label>
        <label>Your comment<textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} rows={3} placeholder="What was your experience?" /></label>
        <p className="campus-form-note">One review per account. Saving replaces your previous rating and comment.</p>
        <div className="review-actions"><button className="button primary small" disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
          <button type="button" className="text-button" disabled={busy} onClick={e => save(e, true)}>Remove my review</button></div>
      </form> : <button type="button" className="button outline small" onClick={onSignIn}>Sign in to review</button>}
    </div>}
  </div>;
}
