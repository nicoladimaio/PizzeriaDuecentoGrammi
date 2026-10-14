import type { Dispatch, SetStateAction } from "react";
import type {
  ActionType,
  AdminReservationRow,
  DecisionDialogMode,
} from "@/components/admin-reservations/types";
import type { ReservationDoc } from "@/types/reservation";

type ReservationDetailModalProps = {
  deleteReservation: (code: string) => Promise<void>;
  openDecisionDialog: (mode: DecisionDialogMode, row: ReservationDoc) => void;
  pendingCode: string | null;
  runDecision: (row: ReservationDoc, action: ActionType) => Promise<void>;
  selectedReservation: AdminReservationRow;
  setSelectedCode: Dispatch<SetStateAction<string | null>>;
  statusLabel: (row: ReservationDoc) => "Scaduta" | "Nuova" | "In attesa" | "Confermata" | "Annullata dal cliente" | "Rifiutata";
};

/** Dettaglio di una prenotazione con le azioni. */
export function ReservationDetailModal({
  deleteReservation,
  openDecisionDialog,
  pendingCode,
  runDecision,
  selectedReservation,
  setSelectedCode,
  statusLabel,
}: ReservationDetailModalProps) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <div className="admin-modal-head">
          <h3>Dettaglio prenotazione</h3>
          <button
            type="button"
            className="btn-secondary admin-modal-btn"
            onClick={() => setSelectedCode(null)}
          >
            Chiudi
          </button>
        </div>

        <p>
          <strong>Cliente:</strong> {selectedReservation.customerName}
        </p>
        <p>
          <strong>Telefono:</strong> {selectedReservation.phone || "-"}
        </p>
        <p>
          <strong>Data/Ora richieste:</strong> {selectedReservation.date}{" "}
          alle {selectedReservation.time}
        </p>
        <p>
          <strong>Persone:</strong> {selectedReservation.guests}
        </p>
        <p>
          <strong>Stato:</strong> {statusLabel(selectedReservation)}
        </p>
        <p>
          <strong>Arrivo cliente:</strong>{" "}
          {selectedReservation.arrived ? "Presente" : "Non presente"}
        </p>
        {selectedReservation.status === "proposed" &&
        selectedReservation.proposedDate &&
        selectedReservation.proposedTime ? (
          <p>
            <strong>Proposta attuale:</strong>{" "}
            {selectedReservation.proposedDate} alle{" "}
            {selectedReservation.proposedTime}
          </p>
        ) : null}
        <p>
          <strong>Note:</strong> {selectedReservation.notes || "-"}
        </p>

        {(() => {
          const isBusy = pendingCode === selectedReservation.code;
          const isConfirmedReservation =
            selectedReservation.status === "confirmed";

          return (
            <div className="booking-form" style={{ marginTop: "0.7rem" }}>
              {!isConfirmedReservation ? (
                <div className="two-cols admin-decision-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isBusy}
                    onClick={() =>
                      void runDecision(selectedReservation, "confirmed")
                    }
                  >
                    Conferma
                  </button>
                  <button
                    type="button"
                    className="btn-secondary admin-modal-btn admin-decision-reject"
                    disabled={isBusy}
                    onClick={() =>
                      openDecisionDialog("rejected", selectedReservation)
                    }
                  >
                    Rifiuta
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn admin-decision-reject"
                  disabled={isBusy}
                  onClick={() =>
                    openDecisionDialog("rejected", selectedReservation)
                  }
                >
                  Annulla prenotazione
                </button>
              )}

              {!isConfirmedReservation ? (
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn admin-decision-propose"
                  disabled={isBusy}
                  onClick={() =>
                    openDecisionDialog("proposed", selectedReservation)
                  }
                >
                  Proponi nuovo orario
                </button>
              ) : null}

              {!isConfirmedReservation ? (
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn admin-decision-reject"
                  disabled={isBusy}
                  onClick={() =>
                    void deleteReservation(selectedReservation.code)
                  }
                >
                  Elimina prenotazione
                </button>
              ) : null}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
