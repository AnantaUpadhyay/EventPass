import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Link2, Copy, Check, Trash2, MousePointer2, Layers, RefreshCw, Pencil, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { PageTitle, ErrorMessage, Empty, Loading } from '../components/UI';
export default function LinksPage() {
  const { token } = useAuth();
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [title, setTitle] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [instances, setInstances] = useState([]);
  const load = useCallback(async () => { setError(''); try { const data = await api('/api/links', { token }); setLinks(data.links); } catch (err) { setError(err.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  async function create(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const { link } = await api('/api/links', { token, method: 'POST', body: { url, title, ...(alias ? { alias } : {}), ...(expiry ? { expiresAt: new Date(expiry).toISOString() } : {}) } }); setLinks(old => [link, ...old]); setUrl(''); setAlias(''); setTitle(''); setExpiry(''); setNotice(`Your link is ready: ${window.location.origin}${link.shortPath}`); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function copy(link) { try { await navigator.clipboard.writeText(`${window.location.origin}${link.shortPath}`); setCopied(link.code); setTimeout(() => setCopied(null), 2000); } catch { setNotice(`Copy this link: ${window.location.origin}${link.shortPath}`); } }
  async function remove(code) { setBusy(true); try { await api(`/api/links/${code}`, { token, method: 'DELETE' }); setLinks(old => old.filter(l => l.code !== code)); setDeleting(null); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function update(e) { e.preventDefault(); setBusy(true); try { const { link } = await api(`/api/links/${editing}`, { token, method: 'PATCH', body: { url: editUrl } }); setLinks(old => old.map(l => l.code === editing ? link : l)); setEditing(null); setNotice('Destination updated. Your short link stays the same.'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function probe() {
    setBusy(true); setInstances([]); setError('');
    try { const samples = []; for (let i = 0; i < 6; i++) { const data = await api('/api/links/instance'); samples.push(data.instance); } setInstances(samples); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div><PageTitle eyebrow="LINK STUDIO" title="Short links" description="Create a link, update its destination, and see how it travels." /><div className="link-studio-layout"><section className="link-create"><div className="link-create-icon"><Link2 size={26} /></div><span className="eyebrow">CREATE A LINK</span><h2>One destination.<br /><span className="serif-word">Fewer characters.</span></h2><form onSubmit={create}><label>Destination URL<input type="url" placeholder="https://example.com/your-event" value={url} onChange={e => setUrl(e.target.value)} required maxLength={2048} /></label><div className="form-two"><label>Custom alias <span className="optional">optional</span><input placeholder="campus-meetup" pattern="[A-Za-z0-9_-]{3,32}" value={alias} onChange={e => setAlias(e.target.value)} /></label><label>Link name <span className="optional">optional</span><input placeholder="e.g. Design evening" maxLength={100} value={title} onChange={e => setTitle(e.target.value)} /></label></div><label>Expires at <span className="optional">optional · your local time</span><input type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /></label><button className="button primary full" disabled={busy}>{busy ? 'Working on it…' : 'Create short link'}<ArrowUpRight size={18} /></button></form></section><aside className="link-stats"><div><span className="eyebrow">AT A GLANCE</span><h3>A record of<br />what you share.</h3></div><div className="link-metric"><Link2 size={20} /><span><b>{links.length}</b>links created</span></div><div className="link-metric"><MousePointer2 size={20} /><span><b>{links.reduce((sum, l) => sum + l.clicks, 0)}</b>total visits</span></div><div className="link-scale-note"><Layers size={19} /><span>Two replicas. One shared database.<small>Round-robin routing at the gateway.</small></span></div><button className="text-button" disabled={busy} onClick={probe}>Test load balancing <ArrowUpRight size={16} /></button>{instances.length > 0 && <div className="replica-results" role="status">{instances.map((id, i) => <span key={i} className={id === 'shortener-1' ? 'replica-one' : 'replica-two'}>{i + 1} / {id}</span>)}</div>}</aside></div><ErrorMessage>{error}</ErrorMessage>{notice && <div className="notice" role="status">{notice}</div>}<div className="section-top link-list-heading"><h2>Your links<span className="purple">.</span></h2><button className="button outline small" onClick={load}><RefreshCw size={15} /> Refresh stats</button></div>{loading ? <Loading /> : links.length ? <div className="links-table"><div className="links-table-head"><span>THE LINK</span><span>DESTINATION</span><span>VISITS</span><span>ACTIONS</span></div>{links.map(link => <div className="link-table-row" key={link.code}><div><b>{link.title || 'Untitled link'}</b><a href={link.shortPath} target="_blank" rel="noreferrer">{window.location.host}/r/{link.code} <ArrowUpRight size={12} /></a><small>{link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'No expiration'}{link.expiresAt && new Date(link.expiresAt) < new Date() ? ' · Expired' : ''}</small></div><div className="link-destination">{editing === link.code ? <form className="inline-edit" onSubmit={update}><input aria-label="New destination" type="url" required value={editUrl} onChange={e => setEditUrl(e.target.value)} /><button aria-label="Save destination" disabled={busy}><Check size={15} /></button><button type="button" onClick={() => setEditing(null)} aria-label="Cancel edit"><X size={15} /></button></form> : <span title={link.url}>{link.url}</span>}</div><b className="visit-count">{link.clicks}</b><div className="row-actions"><button className="icon-button" aria-label="Copy short link" onClick={() => copy(link)}>{copied === link.code ? <Check size={16} /> : <Copy size={16} />}</button><button className="icon-button" aria-label="Edit link destination" onClick={() => { setEditing(link.code); setEditUrl(link.url); }}><Pencil size={15} /></button>{deleting === link.code ? <><button className="text-button danger" disabled={busy} onClick={() => remove(link.code)}>Delete?</button><button className="icon-button" aria-label="Cancel deletion" onClick={() => setDeleting(null)}><X size={14} /></button></> : <button className="icon-button" aria-label="Delete link" onClick={() => setDeleting(link.code)}><Trash2 size={15} /></button>}</div></div>)}</div> : <Empty title="No links yet." icon={Link2}>Add a destination above to create your first short link.</Empty>}</div>;
}
