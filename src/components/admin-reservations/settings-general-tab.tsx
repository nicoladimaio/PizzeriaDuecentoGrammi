import type { Dispatch, SetStateAction } from "react";
import {
  halfHourTimeOptions,
  slotMinuteOptions,
  weekdayOptions,
} from "@/components/admin-reservations/settings";
import type { ReservationSettings } from "@/types/reservation";

type SettingsGeneralTabProps = {
  setSettings: Dispatch<SetStateAction<ReservationSettings>>;
  settings: ReservationSettings;
  toggleWorkingDay: (day: number) => void;
};

/** Impostazioni: orari, intervallo e capienza. */
export function SettingsGeneralTab({
  setSettings,
  settings,
  toggleWorkingDay,
}: SettingsGeneralTabProps) {
  return (
    <div className="admin-settings-tab-panel">
  <div className="admin-settings-row admin-settings-row-3">
    <div className="admin-settings-time-inline">
      <label>
        Orario apertura
        <select
          value={settings.openTime}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              openTime: event.target.value,
            }))
          }
        >
          {halfHourTimeOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </label>
      <label>
        Orario chiusura
        <select
          value={settings.closeTime}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              closeTime: event.target.value,
            }))
          }
        >
          {halfHourTimeOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </label>
    </div>
        <label className="admin-settings-interval-field">
          Intervallo standard
          <select
            value={settings.slotMinutes}
        onChange={(event) =>
          setSettings((prev) => ({
            ...prev,
            slotMinutes:
              Number(event.target.value) === 15 ? 15 : 30,
          }))
        }
      >
        {slotMinuteOptions.map((option) => (
          <option key={option} value={option}>
            {option} minuti
          </option>
        ))}
      </select>
    </label>
        <div />
  </div>

  <div>
    <label>
      Capienza per fascia oraria
      <input
        type="number"
        min={1}
        max={500}
        value={settings.capacityPerSlot}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed) || parsed < 1) return;
          const normalized = Math.min(500, Math.round(parsed));
          setSettings((prev) => ({
            ...prev,
            capacityPerSlot: normalized,
          }));
        }}
      />
    </label>
  </div>

  <div>
    <p className="booking-step-title">Giorni lavorativi</p>
    <div className="admin-inline-chips">
      {weekdayOptions.map((day) => (
        <button
          key={day.key}
          type="button"
          className={
            settings.workingDays.includes(day.key)
              ? "booking-chip active"
              : "booking-chip"
          }
          onClick={() => toggleWorkingDay(day.key)}
        >
          {day.label}
        </button>
      ))}
    </div>
  </div>
    </div>
  );
}
