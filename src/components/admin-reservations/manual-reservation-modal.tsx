import type { Dispatch, SetStateAction } from "react";
import { todayKey } from "@/components/admin-reservations/dates";
import type {
  ManualReservationForm,
} from "@/components/admin-reservations/types";

type ManualReservationModalProps = {
  manualReservationError: string | null;
  manualReservationForm: ManualReservationForm;
  manualReservationMaxDate: string;
  manualReservationSaving: boolean;
  manualTimeOptions: string[];
  setManualReservationForm: Dispatch<SetStateAction<ManualReservationForm>>;
  setShowManualReservationModal: Dispatch<SetStateAction<boolean>>;
  submitManualReservation: () => Promise<void>;
};

/** Inserimento manuale di una prenotazione (es. al telefono). */
export function ManualReservationModal({
  manualReservationError,
  manualReservationForm,
  manualReservationMaxDate,
  manualReservationSaving,
  manualTimeOptions,
  setManualReservationForm,
  setShowManualReservationModal,
  submitManualReservation,
}: ManualReservationModalProps) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal admin-manual-reservation-modal">
        <div className="admin-modal-head">
          <h3>Aggiungi prenotazione</h3>
          <button
            type="button"
            className="btn-secondary admin-modal-btn"
            onClick={() => setShowManualReservationModal(false)}
            disabled={manualReservationSaving}
          >
            Chiudi
          </button>
        </div>

        <div className="booking-form">
          <label>
            Nome e cognome
            <input
              value={manualReservationForm.customerName}
              onChange={(event) =>
                setManualReservationForm((prev) => ({
                  ...prev,
                  customerName: event.target.value,
                }))
              }
            />
          </label>

          <div className="two-cols">
            <label>
              Telefono (opzionale)
              <input
                value={manualReservationForm.phone}
                onChange={(event) =>
                  setManualReservationForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Email (opzionale)
              <input
                type="email"
                value={manualReservationForm.email}
                onChange={(event) =>
                  setManualReservationForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="two-cols">
            <label>
              Data
              <input
                type="date"
                value={manualReservationForm.date}
                min={todayKey()}
                max={manualReservationMaxDate}
                onChange={(event) =>
                  setManualReservationForm((prev) => ({
                    ...prev,
                    date: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Orario
              <select
                value={manualReservationForm.time}
                onChange={(event) =>
                  setManualReservationForm((prev) => ({
                    ...prev,
                    time: event.target.value,
                  }))
                }
              >
                {manualTimeOptions.map((timeOption) => (
                  <option key={timeOption} value={timeOption}>
                    {timeOption}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="two-cols">
            <label>
              Persone
              <input
                type="number"
                min={1}
                max={20}
                value={manualReservationForm.guests}
                onChange={(event) =>
                  setManualReservationForm((prev) => ({
                    ...prev,
                    guests: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label>
            Note
            <textarea
              rows={3}
              maxLength={300}
              value={manualReservationForm.notes}
              onChange={(event) =>
                setManualReservationForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
            />
          </label>

          {manualReservationError ? (
            <p className="error-text">{manualReservationError}</p>
          ) : null}

          <div className="booking-step-actions two-buttons">
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              onClick={() => setShowManualReservationModal(false)}
              disabled={manualReservationSaving}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void submitManualReservation()}
              disabled={manualReservationSaving}
            >
              {manualReservationSaving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
