import type { Dispatch, SetStateAction } from "react";
import {
  monthLabel,
  shiftMonth,
  todayKey,
} from "@/components/admin-reservations/dates";
import type { CalendarCell } from "@/components/admin-reservations/types";

type ConfirmedCalendarModalProps = {
  confirmedCalendarCells: CalendarCell[];
  confirmedCalendarMonth: string;
  confirmedCalendarNextMonthDisabled: boolean;
  confirmedCalendarPrevMonthDisabled: boolean;
  confirmedCountsByDate: Map<string, number>;
  confirmedSelectedDate: string;
  manualReservationMaxDate: string;
  manualReservationMinHistoricDate: string;
  selectConfirmedCalendarDate: (dateKey: string) => void;
  setConfirmedCalendarMonth: Dispatch<SetStateAction<string>>;
  setConfirmedCalendarOpen: Dispatch<SetStateAction<boolean>>;
};

/** Calendario per scegliere il giorno delle confermate. */
export function ConfirmedCalendarModal({
  confirmedCalendarCells,
  confirmedCalendarMonth,
  confirmedCalendarNextMonthDisabled,
  confirmedCalendarPrevMonthDisabled,
  confirmedCountsByDate,
  confirmedSelectedDate,
  manualReservationMaxDate,
  manualReservationMinHistoricDate,
  selectConfirmedCalendarDate,
  setConfirmedCalendarMonth,
  setConfirmedCalendarOpen,
}: ConfirmedCalendarModalProps) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal admin-calendar-modal admin-confirmed-calendar-modal">
        <div className="admin-modal-head">
          <h3>Seleziona un giorno</h3>
          <button
            type="button"
            className="btn-secondary admin-modal-btn admin-confirmed-calendar-close"
            onClick={() => setConfirmedCalendarOpen(false)}
          >
            Chiudi
          </button>
        </div>

        <div className="admin-holiday-calendar admin-confirmed-calendar">
          <div className="admin-holiday-calendar-head">
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              disabled={confirmedCalendarPrevMonthDisabled}
              onClick={() =>
                setConfirmedCalendarMonth((prev) => shiftMonth(prev, -1))
              }
            >
              ←
            </button>
            <strong>{monthLabel(confirmedCalendarMonth)}</strong>
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              disabled={confirmedCalendarNextMonthDisabled}
              onClick={() =>
                setConfirmedCalendarMonth((prev) => shiftMonth(prev, 1))
              }
            >
              →
            </button>
          </div>

          <div className="admin-holiday-weekdays">
            <span>L</span>
            <span>M</span>
            <span>M</span>
            <span>G</span>
            <span>V</span>
            <span>S</span>
            <span>D</span>
          </div>

          <div className="admin-holiday-days">
            {confirmedCalendarCells.map((cell, index) => {
              if (cell.kind === "empty") {
                return (
                  <span
                    key={`confirmed-empty-${index}`}
                    className="admin-holiday-empty"
                  />
                );
              }

              const isDisabled =
                cell.dateKey < manualReservationMinHistoricDate ||
                cell.dateKey > manualReservationMaxDate;
              const isActive = confirmedSelectedDate === cell.dateKey;
              const isPast = cell.dateKey < todayKey();
              const reservationsCount =
                confirmedCountsByDate.get(cell.dateKey) ?? 0;

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  className={
                    isActive
                      ? "admin-holiday-day admin-confirmed-calendar-day active"
                      : isPast
                        ? "admin-holiday-day admin-confirmed-calendar-day past"
                        : "admin-holiday-day admin-confirmed-calendar-day"
                  }
                  disabled={isDisabled}
                  onClick={() => selectConfirmedCalendarDate(cell.dateKey)}
                >
                  <span>{cell.day}</span>
                  <span className="admin-confirmed-calendar-day-meta">
                    {reservationsCount > 0 ? (
                      <small>{reservationsCount}</small>
                    ) : (
                      <small>&nbsp;</small>
                    )}
                    {reservationsCount > 0 ? (
                      <span
                        className="admin-confirmed-calendar-dot"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="admin-confirmed-calendar-legend">
            Gli ultimi 14 giorni sono disponibili come storico.
          </p>
        </div>
      </div>
    </div>
  );
}
