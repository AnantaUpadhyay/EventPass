import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Check, Database, Layers, RefreshCw, Server, ShieldCheck, Workflow, ExternalLink, Zap, Mail, Link2 } from 'lucide-react';
import { api } from '../api';
import { changeView } from '../motion';
import { PageTitle, ErrorMessage, Loading } from '../components/UI';
const serviceNames = ['auth', 'catalog', 'booking', 'notifications'];
const endpoints = [
  ['POST', '/api/auth/register', 'Create a student account'], ['POST', '/api/auth/login', 'Return a signed JWT'], ['GET', '/api/auth/me', 'Get your profile'],
  ['GET', '/api/catalog/events', 'Search and filter the catalog'], ['GET', '/api/catalog/events/:id', 'Read an event'], ['POST', '/api/catalog/events', 'Create an event · admin'],
  ['GET', '/api/booking/seats/:eventId', 'Read live seat availability'], ['POST', '/api/booking/hold', 'Hold a seat for 10 minutes'], ['POST', '/api/booking/release', 'Release your hold'], ['POST', '/api/booking/confirm', 'Confirm · Idempotency-Key required'], ['GET', '/api/booking/mine', 'Read your saved tickets'],
  ['GET', '/api/notifications/mine', 'Read email delivery status'], ['GET', '/api/notifications/logs', 'Read delivery logs · admin']
];
export default function DashboardPage() {
  const [services, setServices] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [samples, setSamples] = useState([]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('architecture');
  const load = useCallback(async () => {
    setLoading(true);
    const statuses = await Promise.all(serviceNames.map(async name => {
      try { return { name, ...await api(`/api/health/${name}`) }; } catch { return { name, status: 'DOWN' }; }
    }));
    setServices(statuses);
    const results = await Promise.allSettled([api('/api/catalog/metrics'), api('/api/booking/metrics')]);
    setMetrics({ catalog: results[0].status === 'fulfilled' ? results[0].value : null, booking: results[1].status === 'fulfilled' ? results[1].value : null });
    setUpdated(new Date()); setLoading(false);
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);
  async function test() {
    setTesting(true); setError(''); const output = [];
    try { for (let i = 0; i < 8; i++) { const start = performance.now(); const result = await api('/api/links/instance'); output.push({ instance: result.instance, ms: Math.round(performance.now() - start) }); } setSamples(output); }
    catch (err) { setError(err.message); } finally { setTesting(false); }
  }
  const up = services.filter(s => s.status === 'UP').length;
  const hits = metrics?.catalog?.cacheHits || 0, misses = metrics?.catalog?.cacheMisses || 0;
  return <div><PageTitle eyebrow="OPERATIONS" title="System overview" description="Real service health, live cache metrics, and a look under the hood." action={<button className="button outline small" disabled={loading} onClick={load}><RefreshCw size={16} className={loading ? 'spinning' : ''} /> Refresh checks</button>} /><div className="system-status"><span className={`status-dot ${up === 4 ? '' : 'pending'}`} /><b>{loading && !services.length ? 'Checking the system…' : up === 4 ? 'All services are operational.' : `${up} of 4 service instances are healthy.`}</b><span>{updated ? `Checked ${updated.toLocaleTimeString()}` : 'Live checks'}</span></div><div className="metrics-grid"><Metric label="HEALTHY INSTANCES" value={`${up}/4`} icon={Server} detail="Four independent EventPass services" /><Metric label="CACHE HIT RATE" value={hits + misses ? `${Math.round(hits / (hits + misses) * 100)}%` : '—'} icon={Zap} detail={`${hits} hits · ${misses} misses · this process`} /><Metric label="HOLD CONFLICTS STOPPED" value={metrics?.booking?.conflictsPrevented ?? '—'} icon={ShieldCheck} detail="Rejected competing hold requests" /><Metric label="TICKETS CONFIRMED" value={metrics?.booking?.bookingsConfirmed ?? '—'} icon={TicketIcon} detail="Since this booking process started" /></div><div className="service-grid">{services.map(s => <div className="service-item" key={s.name}><Server size={17} /><div><b>{s.name}</b><small>{s.instance || 'Not reachable'}</small></div><span className={`health-pill ${s.status === 'UP' ? '' : 'down'}`}>{s.status}</span></div>)}</div><div className="system-tabs"><button className={tab === 'architecture' ? 'active' : ''} onClick={() => changeView(() => setTab('architecture'))}>System architecture</button><button className={tab === 'schema' ? 'active' : ''} onClick={() => changeView(() => setTab('schema'))}>Database schema</button><button className={tab === 'api' ? 'active' : ''} onClick={() => changeView(() => setTab('api'))}>API reference <span>{endpoints.length}</span></button></div>{tab === 'architecture' && <><section className="architecture-panel"><div className="section-top"><div><span className="eyebrow">SERVICE ARCHITECTURE</span><h2>How it fits together.</h2></div><span className="pill light">React · Node.js · MongoDB · Redis</span></div><div className="architecture-flow"><div className="arch-tier"><span className="arch-index">01 / EXPERIENCE</span><div className="arch-node dark-node"><span>React application</span><small>Discover · Book · Share</small></div></div><span className="flow-line" /><div className="arch-tier"><span className="arch-index">02 / ROUTING</span><div className="arch-node violet-node"><span>API gateway / load balancer</span><small>NGINX in Docker · Node gateway locally</small></div></div><span className="flow-line" /><div className="arch-tier"><span className="arch-index">03 / SERVICES</span><div className="arch-services">{[['Auth', 'JWT + bcrypt'], ['Catalog', 'Cache-aside'], ['Booking', 'Locks + outbox'], ['Mail worker', 'SMTP + retries']].map(([label, detail]) => <div className="arch-node" key={label}><span>{label}</span><small>{detail}</small></div>)}</div></div><span className="flow-line" /><div className="arch-storage"><div className="arch-node"><Database size={20} /><span>MongoDB</span><small>Durable records · unique seat constraint</small></div><div className="arch-node"><Layers size={20} /><span>Redis</span><small>10-minute holds · cache · rate limits</small></div></div></div></section><div className="system-two"><section className="panel booking-state"><span className="eyebrow">THE RESERVATION LIFECYCLE</span><h2>From selection to ticket.</h2><div className="state-step"><i>01</i><div><b>Available</b><p>Choose a valid seat from the live map.</p></div></div><div className="state-step"><i>02</i><div><b>Held · 10-minute lease</b><p>Atomic Redis Lua / SET NX. Other users receive 409.</p></div></div><div className="state-step"><i>03</i><div><b>Confirmed</b><p>MongoDB unique event + seat index. Ticket and mail outbox saved together.</p></div></div><div className="state-step"><i>↺</i><div><b>Expired or released</b><p>Lease expires automatically. Seat becomes available.</p></div></div></section></div></>}{tab === 'schema' && <div className="schema-grid">{[
    ['Users', 'eventpass_auth.users', '_id · ObjectId PK\nname · String\nemail · String UNIQUE\npasswordHash · bcrypt hash\nrole · student | admin\ncreatedAt · Date', 'Public registration always creates a student.'],
    ['Events', 'eventpass_catalog.events', '_id · String PK\ntitle, description, category\nvenue, date, time\nprice · Number ≥ 0\ntotalSeats · 1–400\nseatLayout · { rows, seatsPerRow }', 'Only administrators can create events.'],
    ['Bookings + outbox', 'eventpass_booking.bookings', 'bookingId · UUID UNIQUE\nuserId, requestId · UNIQUE pair\neventId, seatNumber · UNIQUE if confirmed\nprice · Server-derived snapshot\nticketCode · UNIQUE\nqrCodeData · Data URI\noutbox · { status, sentAt }', 'One document atomically saves ticket and email intent.'],
    ['Notifications', 'eventpass_notifications.notifications', 'bookingId · String UNIQUE\nuserId, userEmail, eventTitle\nstatus · PENDING | SENDING | SENT | FAILED\nattempts, nextAttempt, leaseUntil\nmessageId, sentAt, lastError', 'Durable retries and worker leases. SMTP is at-least-once.'],
    ['Redis keys', 'Ephemeral coordination', 'hold:{eventId}:seat · owner + 600s TTL\nholds:{eventId} · expiry sorted set\ninventory:{eventId} · advisory counter\ncatalog:version · cache invalidation\ncatalog:* / event:* · 300s TTL\nauth:limit:* / links:limit:* · 60s TTL', 'Booking fails closed when Redis is unavailable.']
  ].map(([title, db, fields, note]) => <section className="schema-card" key={title}><Database size={20} /><h3>{title}</h3><code>{db}</code><pre>{fields}</pre><p>{note}</p></section>)}</div>}{tab === 'api' && <div className="api-reference">{endpoints.map(([method, path, description]) => <div key={`${method}${path}`}><span className={`method method-${method.toLowerCase()}`}>{method}</span><code>{path}</code><span>{description}</span></div>)}<p>Authenticated routes use Authorization: Bearer &lt;token&gt;. Internal outbox endpoints are not exposed by the gateway.</p></div>}<div className="lab-note"><Workflow size={22} /><div><b>Backend implementation overview.</b><p>Idea, architecture, database schema, independent services, a working booking flow, and email delivery.</p></div><a href="http://localhost:8025" target="_blank" rel="noreferrer">Open local mail inbox <ExternalLink size={15} /></a></div></div>;
}
function Metric({ label, value, detail, icon: Icon }) { return <div className="metric"><div><span>{label}</span><Icon size={18} /></div><b>{value}</b><p>{detail}</p></div>; }
function TicketIcon(props) { return <Check {...props} />; }
