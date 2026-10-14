import { formatDateShort } from "@/components/admin-reservations/dates";
import { proposalDatesPageSize } from "@/components/admin-reservations/helpers";
import type {
  ActionType,
  AdminReservationRow,
  DecisionAvailability,
  DecisionDialogMode,
  ProposalDraft,
} from "@/components/admin-reservations/types";
import type { ReservationDoc } from "@/types/reservation";

type ReservationDecisionDialogProps = {
  availableProposalDays: string[];
  closeDecisionDialog: () => void;
  currentProposalDate: string;
  currentProposalPageStart: number;
  decisionAvailability: DecisionAvailability | null;
  decisionDialogMode: DecisionDialogMode;
  decisionError: string | null;
  decisionLoading: boolean;
  drafts: Record<string, ProposalDraft>;
  onDraftChange: (code: string, key: keyof ProposalDraft, value: string) => void;
  pagedProposalDays: string[];
  pendingCode: string | null;
  runDecision: (row: ReservationDoc, action: ActionType) => Promise<void>;
  selectedReservation: AdminReservationRow;
  setProposalDate: (code: string, dateValue: string) => void;
};

/** Rifiuto, annullamento o proposta di un altro orario, con messaggio al cliente. */
export function ReservationDecisionDialog({
  availableProposalDays,
  closeDecisionDialog,
  currentProposalDate,
  currentProposalPageStart,
  decisionAvailability,
  decisionDialogMode,
  decisionError,
  decisionLoading,
  drafts,
  onDraftChange,
  pagedProposalDays,
  pendingCode,
  runDecision,
  selectedReservation,
  setProposalDate,
}: ReservationDecisionDialogProps) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal admin-calendar-modal">
        <div className="admin-modal-head">
          <h3>
            {decisionDialogMode === "rejected"
              ? selectedReservation.status === "confirmed"
                ? "Annulla prenotazione"
                : "Rifiuta prenotazione"
              : "Proponi nuovo orario"}
          </h3>
        </div>

        <div className="booking-form">
          <label>
            Messaggio al cliente
            <textarea
              value={drafts[selectedReservation.code]?.ownerResponse ?? ""}
              rows={2}
              maxLength={300}
              placeholder={
                decisionDialogMode === "proposed"
                  ? "Se lasci vuoto verrà inviato un messaggio standard di proposta."
                  : selectedReservation.status === "confirmed"
                    ? "Se lasci vuoto verrà inviato un messaggio standard di annullamento."
                    : "Se lasci vuoto verrà inviato un messaggio standard di rifiuto."
              }
              onChange={(event) =>
                onDraftChange(
                  selectedReservation.code,
                  "ownerResponse",
                  event.target.value,
                )
              }
            />
            <small className="admin-decision-hint">
              Scrivi un messaggio personalizzato, oppure lascia vuoto per
              usare automaticamente il messaggio standard
              {selectedReservation.status === "confirmed" &&
              decisionDialogMode === "rejected"
                ? " di annullamento"
                : ""}
              , che arriva nella lingua del cliente. Il messaggio
              personalizzato viene inviato così come lo scrivi.
            </small>
          </label>

          {decisionDialogMode === "proposed" ? (
            <>
              {decisionLoading ? (
                <p className="section-subtitle">
                  Caricamento disponibilita...
                </p>
              ) : null}

              {!decisionLoading && decisionAvailability ? (
                <>
                  <p className="booking-step-title">Data proposta</p>
                  {availableProposalDays.length > 0 ? (
                    <>
                      <div className="admin-proposal-date-nav">
                        <button
                          type="button"
                          className="admin-confirmed-day-btn"
                          disabled={currentProposalPageStart === 0}
                          onClick={() => {
                            const previousPageStart =
                              currentProposalPageStart -
                              proposalDatesPageSize;
                            if (previousPageStart >= 0) {
                              setProposalDate(
                                selectedReservation.code,
                                availableProposalDays[previousPageStart],
                              );
                            }
                          }}
                        >
                          ←
                        </button>
                        <strong className="admin-proposal-date-label">
                          {`${Math.min(currentProposalPageStart + 1, availableProposalDays.length)}-${Math.min(
                            currentProposalPageStart +
                              proposalDatesPageSize,
                            availableProposalDays.length,
                          )} di ${availableProposalDays.length}`}
                        </strong>
                        <button
                          type="button"
                          className="admin-confirmed-day-btn"
                          disabled={
                            currentProposalPageStart +
                              proposalDatesPageSize >=
                            availableProposalDays.length
                          }
                          onClick={() => {
                            const nextPageStart =
                              currentProposalPageStart +
                              proposalDatesPageSize;
                            if (
                              nextPageStart < availableProposalDays.length
                            ) {
                              setProposalDate(
                                selectedReservation.code,
                                availableProposalDays[nextPageStart],
                              );
                            }
                          }}
                        >
                          →
                        </button>
                      </div>

                      <div
                        className="admin-proposal-time-grid"
                        role="group"
                      >
                        {pagedProposalDays.map((dateValue) => (
                          <button
                            key={dateValue}
                            type="button"
                            className={
                              currentProposalDate === dateValue
                                ? "admin-proposal-time-card active"
                                : "admin-proposal-time-card"
                            }
                            onClick={() =>
                              setProposalDate(
                                selectedReservation.code,
                                dateValue,
                              )
                            }
                          >
                            {formatDateShort(dateValue)}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <p
                    className="booking-step-title"
                    style={{ marginTop: "0.5rem" }}
                  >
                    Orario proposto
                  </p>
                  <div className="admin-proposal-time-grid" role="group">
                    {(
                      decisionAvailability.slotsByDate[
                        currentProposalDate
                      ] ?? []
                    )
                      .filter((slot) => slot.available)
                      .map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          className={
                            drafts[selectedReservation.code]
                              ?.proposedTime === slot.time
                              ? "admin-proposal-time-card active"
                              : "admin-proposal-time-card"
                          }
                          onClick={() =>
                            onDraftChange(
                              selectedReservation.code,
                              "proposedTime",
                              slot.time,
                            )
                          }
                        >
                          {slot.time}
                        </button>
                      ))}
                  </div>
                </>
              ) : null}

              {!decisionLoading &&
              decisionAvailability &&
              decisionAvailability.days.filter((day) => day.hasAvailability)
                .length === 0 ? (
                <p className="section-subtitle">
                  Non ci sono date disponibili da proporre con le
                  impostazioni correnti.
                </p>
              ) : null}
            </>
          ) : null}

          {decisionError ? (
            <p className="error-text">{decisionError}</p>
          ) : null}

          <div className="booking-step-actions two-buttons">
            <button
              type="button"
              className="btn-secondary admin-modal-btn"
              onClick={closeDecisionDialog}
              disabled={pendingCode === selectedReservation.code}
            >
              Annulla
            </button>

            <button
              type="button"
              className={
                decisionDialogMode === "rejected"
                  ? "btn-secondary admin-modal-btn admin-decision-reject"
                  : "btn-secondary admin-modal-btn admin-decision-propose"
              }
              disabled={
                pendingCode === selectedReservation.code ||
                (decisionDialogMode === "proposed" &&
                  (!(
                    drafts[selectedReservation.code]?.proposedDate ?? ""
                  ) ||
                    !(
                      drafts[selectedReservation.code]?.proposedTime ?? ""
                    )))
              }
              onClick={() =>
                void runDecision(selectedReservation, decisionDialogMode)
              }
            >
              {decisionDialogMode === "rejected"
                ? selectedReservation.status === "confirmed"
                  ? "Conferma annullamento"
                  : "Conferma rifiuto"
                : "Invia proposta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
