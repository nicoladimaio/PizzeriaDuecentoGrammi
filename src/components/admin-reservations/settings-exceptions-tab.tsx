import type { ReservationSettings } from "@/types/reservation";

type SettingsExceptionsTabProps = {
  openCalendarPicker: (mode: "holiday" | "opening") => void;
  removeHoliday: (value: string) => void;
  removeSpecialOpening: (value: string) => void;
  settings: ReservationSettings;
};

/** Impostazioni: ferie e aperture straordinarie. */
export function SettingsExceptionsTab({
  openCalendarPicker,
  removeHoliday,
  removeSpecialOpening,
  settings,
}: SettingsExceptionsTabProps) {
  return (
    <div className="admin-settings-tab-panel">
      <div className="admin-chip-head">
        <p className="booking-step-title">
          Festività / chiusure straordinarie
        </p>
        <button
          type="button"
          className="admin-add-chip-btn"
          onClick={() => openCalendarPicker("holiday")}
          aria-label="Aggiungi chiusura straordinaria"
        >
          +
        </button>
      </div>

      <div className="admin-inline-chips admin-chip-scroll">
        {settings.holidays.map((value) => (
          <button
            key={value}
            type="button"
            className="booking-chip"
            onClick={() => removeHoliday(value)}
          >
            {value} ×
          </button>
        ))}
      </div>

      <div
        className="admin-chip-head"
        style={{ marginTop: "0.65rem" }}
      >
        <p className="booking-step-title">Aperture straordinarie</p>
        <button
          type="button"
          className="admin-add-chip-btn"
          onClick={() => openCalendarPicker("opening")}
          aria-label="Aggiungi apertura straordinaria"
        >
          +
        </button>
      </div>
      <div className="admin-inline-chips admin-chip-scroll">
        {settings.specialOpenings.map((value) => (
          <button
            key={value}
            type="button"
            className="booking-chip"
            onClick={() => removeSpecialOpening(value)}
          >
            {value} ×
          </button>
        ))}
      </div>

      {settings.holidays.length === 0 &&
      settings.specialOpenings.length === 0 ? (
        <p className="admin-settings-empty-note">
          Nessuna data speciale configurata.
        </p>
      ) : null}
    </div>
  );
}
