import type { Dispatch, RefObject, SetStateAction } from "react";
import { parseDateKey, todayKey } from "@/components/admin-reservations/dates";
import type {
  AdminReservationRow,
} from "@/components/admin-reservations/types";

type ConfirmedReservationsGroupProps = {
  arrivedPendingCode: string | null;
  confirmedCalendarOpen: boolean;
  confirmedDayStripRef: RefObject<HTMLDivElement | null>;
  confirmedNavigationDays: { date: string; label: string; reservationsCount: number; }[];
  confirmedRowsByTime: { time: string; rows: AdminReservationRow[]; }[];
  confirmedSelectedDate: string;
  confirmedSelectedIndex: number;
  confirmedSelectedSummary: { reservationsCount: number; guestsCount: number; totalSeats: number; availableSeats: number; };
  highlightedCurrentTimeSlot: string;
  isConfirmedSelectedHistoricDay: boolean;
  isConfirmedSelectedPastDay: boolean;
  openConfirmedCalendarPicker: () => void;
  setConfirmedSelectedDate: Dispatch<SetStateAction<string>>;
  setSelectedCode: Dispatch<SetStateAction<string | null>>;
  toggleReservationArrived: (row: AdminReservationRow) => Promise<void>;
};

/** Prenotazioni confermate del giorno scelto. */
export function ConfirmedReservationsGroup({
  arrivedPendingCode,
  confirmedCalendarOpen,
  confirmedDayStripRef,
  confirmedNavigationDays,
  confirmedRowsByTime,
  confirmedSelectedDate,
  confirmedSelectedIndex,
  confirmedSelectedSummary,
  highlightedCurrentTimeSlot,
  isConfirmedSelectedHistoricDay,
  isConfirmedSelectedPastDay,
  openConfirmedCalendarPicker,
  setConfirmedSelectedDate,
  setSelectedCode,
  toggleReservationArrived,
}: ConfirmedReservationsGroupProps) {
  return (
    <div className="admin-reservation-group admin-confirmed-group">
      <>
        <div className="admin-confirmed-day-hero">
          <button
            type="button"
            className="admin-confirmed-day-btn"
            disabled={confirmedSelectedIndex <= 0}
            onClick={() => {
              const idx = confirmedSelectedIndex;
              if (idx > 0) {
                const previousDay = confirmedNavigationDays[idx - 1];
                if (previousDay) {
                  setConfirmedSelectedDate(previousDay.date);
                }
              }
            }}
          >
            ←
          </button>
          <div className="admin-confirmed-day-label">
            <strong>
              {parseDateKey(
                confirmedSelectedDate || todayKey(),
              ).toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </strong>
            {isConfirmedSelectedHistoricDay ? (
              <span className="admin-confirmed-day-meta-chip">
                Storico
              </span>
            ) : null}
            <small className="admin-confirmed-day-summary">
              {`👥 ${confirmedSelectedSummary.guestsCount} coperti · 🍕 ${confirmedSelectedSummary.reservationsCount} ${
                confirmedSelectedSummary.reservationsCount === 1
                  ? "prenotazione"
                  : "prenotazioni"
              }`}
            </small>
          </div>
          <button
            type="button"
            className="admin-confirmed-day-btn"
            disabled={
              confirmedSelectedIndex >=
              confirmedNavigationDays.length - 1
            }
            onClick={() => {
              const idx = confirmedSelectedIndex;
              if (idx >= 0 && idx < confirmedNavigationDays.length - 1) {
                const nextDay = confirmedNavigationDays[idx + 1];
                if (nextDay) {
                  setConfirmedSelectedDate(nextDay.date);
                }
              }
            }}
          >
            →
          </button>
        </div>

        <div className="admin-confirmed-day-strip-wrap">
          <div
            ref={confirmedDayStripRef}
            className="admin-confirmed-day-strip"
            role="toolbar"
            aria-label="Navigazione giorni prenotazioni confermate"
          >
            {confirmedNavigationDays.map((day) => (
              <button
                key={day.date}
                type="button"
                aria-pressed={confirmedSelectedDate === day.date}
                className={
                  confirmedSelectedDate === day.date
                    ? "admin-confirmed-day-pill active"
                    : "admin-confirmed-day-pill"
                }
                onClick={() => {
                  setConfirmedSelectedDate(day.date);
                }}
              >
                <span className="admin-confirmed-day-pill-label">
                  {day.label}
                </span>
                {day.reservationsCount > 0 ? (
                  <span className="admin-confirmed-day-pill-badge">
                    {day.reservationsCount}
                  </span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              className="admin-confirmed-day-pill admin-confirmed-day-pill-calendar"
              onClick={openConfirmedCalendarPicker}
              aria-label="Apri calendario"
              aria-pressed={confirmedCalendarOpen}
            >
              <span className="admin-confirmed-day-pill-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="5" width="17" height="15" rx="3" />
                  <path d="M7.5 3.5v3" />
                  <path d="M16.5 3.5v3" />
                  <path d="M3.5 9.5h17" />
                </svg>
              </span>
              <span className="admin-confirmed-day-pill-label">
                Calendario
              </span>
            </button>
          </div>
        </div>

        {confirmedRowsByTime.length === 0 ? (
          <div className="admin-confirmed-empty-state">
            <span className="admin-confirmed-empty-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="5" width="16" height="15" rx="3" />
                <path d="M8 3.5v3" />
                <path d="M16 3.5v3" />
                <path d="M4 9.5h16" />
                <path d="M8.5 13h7" />
              </svg>
            </span>
            <strong>
              {isConfirmedSelectedPastDay
                ? "Nessuna prenotazione registrata in questo giorno."
                : "Nessuna prenotazione per questo giorno"}
            </strong>
            <p>
              {isConfirmedSelectedPastDay
                ? "Questo giorno e disponibile solo per consultazione."
                : "Puoi aggiungerne una manualmente con il pulsante +."}
            </p>
          </div>
        ) : (
          <div className="admin-confirmed-time-groups">
            {confirmedRowsByTime.map((group) => (
              <div
                key={group.time}
                className={
                  highlightedCurrentTimeSlot === group.time
                    ? "admin-time-slot-block current"
                    : "admin-time-slot-block"
                }
              >
                <h5>{group.time}</h5>
                <div className="admin-reservation-list admin-reservation-list-compact-grid">
                  {group.rows.map((row) => (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      className={
                        row.arrived
                          ? "admin-reservation-item admin-reservation-item-compact admin-reservation-item-arrived"
                          : "admin-reservation-item admin-reservation-item-compact"
                      }
                      onClick={() => setSelectedCode(row.code)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          setSelectedCode(row.code);
                        }
                      }}
                    >
                      <span className="admin-reservation-main">
                        <strong>{row.customerName}</strong>
                        <small>
                          {row.guests} persone
                        </small>
                        {row.arrived ? (
                          <span className="admin-arrived-badge">
                            Arrivato
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className={
                          row.arrived
                            ? "admin-presence-toggle active"
                            : "admin-presence-toggle"
                        }
                        disabled={arrivedPendingCode === row.code}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleReservationArrived(row);
                        }}
                        title={
                          row.arrived
                            ? "Segna cliente non presente"
                            : "Segna cliente presente"
                        }
                        aria-label={
                          row.arrived
                            ? "Segna cliente non presente"
                            : "Segna cliente presente"
                        }
                      >
                        {row.arrived ? "✓" : "✕"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    </div>
  );
}
