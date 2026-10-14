import type { Dispatch, SetStateAction } from "react";
import {
  monthLabel,
  shiftMonth,
  todayKey,
} from "@/components/admin-reservations/dates";
import type { CalendarCell } from "@/components/admin-reservations/types";

type SettingsCalendarPickerModalProps = {
  addHolidayByDate: (dateValue: string) => void;
  calendarPickerMode: "holiday" | "opening";
  holidayCalendarCells: CalendarCell[];
  holidayMonth: string;
  isCalendarDayActive: (dateValue: string) => boolean;
  setCalendarPickerOpen: Dispatch<SetStateAction<boolean>>;
  setHolidayMonth: Dispatch<SetStateAction<string>>;
};

/** Calendario per aggiungere ferie o aperture straordinarie. */
export function SettingsCalendarPickerModal({
  addHolidayByDate,
  calendarPickerMode,
  holidayCalendarCells,
  holidayMonth,
  isCalendarDayActive,
  setCalendarPickerOpen,
  setHolidayMonth,
}: SettingsCalendarPickerModalProps) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal admin-calendar-modal">
        <div className="admin-modal-head">
          <h3>
            {calendarPickerMode === "holiday"
              ? "Aggiungi festivita"
              : "Aggiungi apertura straordinaria"}
          </h3>
          <button
            type="button"
            className="btn-secondary admin-modal-btn"
            onClick={() => setCalendarPickerOpen(false)}
          >
            Chiudi
          </button>
        </div>

        <div className="admin-holiday-calendar">
          <div className="admin-holiday-calendar-head">
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              onClick={() =>
                setHolidayMonth((prev) => shiftMonth(prev, -1))
              }
            >
              ←
            </button>
            <strong>{monthLabel(holidayMonth)}</strong>
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              onClick={() => setHolidayMonth((prev) => shiftMonth(prev, 1))}
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
            {holidayCalendarCells.map((cell, index) => {
              if (cell.kind === "empty") {
                return (
                  <span
                    key={`empty-${index}`}
                    className="admin-holiday-empty"
                  />
                );
              }

              const isPast = cell.dateKey < todayKey();
              const isActive = isCalendarDayActive(cell.dateKey);

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  className={
                    isActive
                      ? "admin-holiday-day active"
                      : "admin-holiday-day"
                  }
                  disabled={isPast}
                  onClick={() => addHolidayByDate(cell.dateKey)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
