import React from "react";
import {
  Download,
  MapPin,
  CalendarDays,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { eventDate, money } from "../api";
export default function TicketCard({ booking, onShare }) {
  return (
    <article className="ticket-card">
      <div
        className="ticket-cover"
        style={{
          backgroundImage: `linear-gradient(180deg, transparent, rgba(17,14,22,.8)), url("${booking.bannerUrl}")`,
        }}
      >
        <span className="pill translucent">
          <Check size={13} /> CONFIRMED RESERVATION
        </span>
        <h3>{booking.eventTitle}</h3>
      </div>
      <div className="ticket-body">
        <div className="ticket-details">
          <span>
            <CalendarDays size={15} />
            {eventDate(booking.eventDate)} · {booking.eventTime}
          </span>
          <span>
            <MapPin size={15} />
            {booking.venue}
          </span>
        </div>
        <div className="ticket-seat">
          <span>
            YOUR SEAT<b>{booking.seatNumber}</b>
          </span>
          <span>
            ADMIT
            <b>
              {String(
                booking.quantity || booking.seatNumbers?.length || 1,
              ).padStart(2, "0")}
            </b>
          </span>
          <span>
            AMOUNT<b>{money(booking.price)}</b>
          </span>
        </div>
        <div className="ticket-perforation" />
        <div className="ticket-validation">
          <img
            src={booking.qrCodeData}
            width="100"
            height="100"
            alt={`Ticket QR code for seat ${booking.seatNumber}`}
          />
          <div>
            <span className="eyebrow">YOUR ADMISSION CODE</span>
            <code>{booking.ticketCode}</code>
            <small>Booked for {booking.userName}</small>
          </div>
        </div>
        <div className="ticket-actions">
          <button
            className="button outline small"
            onClick={() => window.print()}
          >
            <Download size={15} /> Print / save PDF
          </button>
          {onShare && (
            <button className="text-button" onClick={() => onShare(booking)}>
              Share event <ArrowUpRight size={15} />
            </button>
          )}
        </div>
        <p className="mock-note">Mock checkout · No payment was collected.</p>
      </div>
    </article>
  );
}
