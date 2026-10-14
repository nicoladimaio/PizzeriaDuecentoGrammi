import type { Dispatch, SetStateAction } from "react";
import { weekdayOptions } from "@/components/admin-reservations/settings";

type CopySettingsModalProps = {
  applyWeeklySlotCopy: () => void;
  copySourceWeekday: number;
  copyTargetWeekdays: number[];
  setCopySourceWeekday: Dispatch<SetStateAction<number>>;
  setShowCopyConfigModal: Dispatch<SetStateAction<boolean>>;
  toggleCopyTargetWeekday: (weekday: number) => void;
};

/** Duplica la configurazione di un giorno della settimana su altri giorni. */
export function CopySettingsModal({
  applyWeeklySlotCopy,
  copySourceWeekday,
  copyTargetWeekdays,
  setCopySourceWeekday,
  setShowCopyConfigModal,
  toggleCopyTargetWeekday,
}: CopySettingsModalProps) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal admin-settings-modal">
        <div className="admin-modal-head">
          <h3>Duplica configurazione</h3>
          <button
            type="button"
            className="btn-secondary admin-modal-btn"
            onClick={() => setShowCopyConfigModal(false)}
          >
            Annulla
          </button>
        </div>

        <div className="booking-form">
          <label>
            Giorno sorgente
            <select
              value={copySourceWeekday}
              onChange={(event) =>
                setCopySourceWeekday(Number(event.target.value))
              }
            >
              {weekdayOptions.map((day) => (
                <option key={day.key} value={day.key}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="booking-step-title">Giorni di destinazione</p>
            <div className="admin-inline-chips">
              {weekdayOptions
                .filter((day) => day.key !== copySourceWeekday)
                .map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className={
                      copyTargetWeekdays.includes(day.key)
                        ? "booking-chip active"
                        : "booking-chip"
                    }
                    onClick={() => toggleCopyTargetWeekday(day.key)}
                  >
                    {day.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="booking-step-actions two-buttons">
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              onClick={() => setShowCopyConfigModal(false)}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={applyWeeklySlotCopy}
              disabled={copyTargetWeekdays.length === 0}
            >
              Duplica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
