import React from 'react';
import { ArrowUpRight, Ticket, X, AlertCircle } from 'lucide-react';
export function Brand() { return <span className="brand"><img className="brand-logo" src="/assets/eventpass-ticket-logo-small.png" width="37" height="37" alt="" />eventpass<span className="brand-period">.</span></span>; }
export function ErrorMessage({ children }) { return children ? <div role="alert" className="error-message"><AlertCircle size={17} /><span>{children}</span></div> : null; }
export function Empty({ title, children, icon: Icon = Ticket }) { return <div className="empty"><span className="empty-icon"><Icon size={28} /></span><h3>{title}</h3><p>{children}</p></div>; }
export function Loading({ label = 'Getting things ready…' }) { return <div className="loading" role="status"><span className="spinner" />{label}</div>; }
export function PageTitle({ eyebrow, title, description, action }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>; }
export function Modal({ title, children, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => ref.current?.querySelectorAll('button:not([disabled]), input, select, textarea, a[href], [tabindex="0"]');
    focusable()?.[0]?.focus();
    const key = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = focusable(); if (!elements?.length) return;
        if (e.shiftKey && document.activeElement === elements[0]) { e.preventDefault(); elements[elements.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === elements[elements.length - 1]) { e.preventDefault(); elements[0].focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-top"><span className="eyebrow">{title}</span><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</section></div>;
}
export function ArrowLink({ children, onClick }) { return <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={17} /></button>; }
