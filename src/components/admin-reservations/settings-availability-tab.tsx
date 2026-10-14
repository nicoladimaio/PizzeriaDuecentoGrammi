import type { Dispatch, RefObject, SetStateAction } from "react";
import { weekdayOptions } from "@/components/admin-reservations/settings";
import type { ReservationSettings } from "@/types/reservation";

type SettingsAvailabilityTabProps = {
  availabilityActionsOpen: boolean;
  availabilityWeekdayStripRef: RefObject<HTMLDivElement | null>;
  regenerateWeeklySlotAvailability: () => void;
  selectedAvailabilitySlots: string[];
  selectedAvailabilityWeekday: number;
  setAvailabilityActionsOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedAvailabilityWeekday: Dispatch<SetStateAction<number>>;
  setShowCopyConfigModal: Dispatch<SetStateAction<boolean>>;
  settings: ReservationSettings;
  slotReservationCountsByWeekdayTime: Map<string, number>;
  toggleWeeklySlotAvailability: (weekday: number, time: string) => void;
};

/** Impostazioni: giorni di apertura e fasce disattivate. */
export function SettingsAvailabilityTab({
  availabilityActionsOpen,
  availabilityWeekdayStripRef,
  regenerateWeeklySlotAvailability,
  selectedAvailabilitySlots,
  selectedAvailabilityWeekday,
  setAvailabilityActionsOpen,
  setSelectedAvailabilityWeekday,
  setShowCopyConfigModal,
  settings,
  slotReservationCountsByWeekdayTime,
  toggleWeeklySlotAvailability,
}: SettingsAvailabilityTabProps) {
  return (
    <div className="admin-settings-tab-panel">
      <div className="admin-settings-info-card admin-settings-info-card-with-actions">
        <div>
          <strong>Disponibilita settimanale</strong>
          <p>
            <span className="admin-settings-copy-desktop">
              Scegli gli orari disponibili per ciascun giorno della
              settimana. Gli slot disattivati non saranno piu
              prenotabili dai clienti. Le prenotazioni gia
              esistenti resteranno valide.
            </span>
            <span className="admin-settings-copy-mobile">
              Attiva o disattiva gli orari prenotabili.
            </span>
          </p>
        </div>
        <div className="admin-settings-actions-menu-wrap">
          <button
            type="button"
            className="btn-secondary admin-modal-btn"
            onClick={() =>
              setAvailabilityActionsOpen((prev) => !prev)
            }
            aria-expanded={availabilityActionsOpen}
          >
            Azioni
          </button>
          {availabilityActionsOpen ? (
            <div className="admin-settings-actions-menu">
              <button
                type="button"
                onClick={() => {
                  setAvailabilityActionsOpen(false);
                  setShowCopyConfigModal(true);
                }}
              >
                Duplica configurazione
              </button>
              <button
                type="button"
                onClick={regenerateWeeklySlotAvailability}
              >
                Rigenera slot
              </button>
              <button
                type="button"
                onClick={regenerateWeeklySlotAvailability}
              >
                Ripristina configurazione standard
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={availabilityWeekdayStripRef}
        className="admin-settings-weekday-strip"
        role="tablist"
        aria-label="Giorni disponibilita orarie"
      >
        {weekdayOptions.map((day) => (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={selectedAvailabilityWeekday === day.key}
            className={
              selectedAvailabilityWeekday === day.key
                ? "admin-settings-weekday-tab active"
                : "admin-settings-weekday-tab"
            }
            onClick={() => setSelectedAvailabilityWeekday(day.key)}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="admin-settings-slot-grid">
        {selectedAvailabilitySlots.map((slotTime) => {
          const isEnabled = !(
            settings.weeklyDisabledSlots[String(selectedAvailabilityWeekday)] ?? []
          ).includes(slotTime);
          const hasExistingReservations =
            (slotReservationCountsByWeekdayTime.get(
              `${selectedAvailabilityWeekday}|${slotTime}`,
            ) ?? 0) > 0;

          return (
            <button
              key={slotTime}
              type="button"
              className={
                isEnabled
                  ? "admin-settings-slot-chip active"
                  : "admin-settings-slot-chip"
              }
              onClick={() =>
                toggleWeeklySlotAvailability(
                  selectedAvailabilityWeekday,
                  slotTime,
                )
              }
            >
              <span>{slotTime}</span>
              {!isEnabled && hasExistingReservations ? (
                <small>Gia prenotato</small>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="admin-settings-note">
        Le prenotazioni gia esistenti restano valide anche se
        disattivi uno slot. La modifica blocca solo nuove
        prenotazioni.
      </p>
    </div>
  );
}
