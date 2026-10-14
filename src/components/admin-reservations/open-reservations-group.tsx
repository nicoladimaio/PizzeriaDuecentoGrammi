import type { Dispatch, SetStateAction } from "react";
import type {
  AdminReservationRow,
} from "@/components/admin-reservations/types";
import type { ReservationDoc } from "@/types/reservation";

type OpenReservationsGroupProps = {
  highlightedCode: string | undefined;
  openRows: AdminReservationRow[];
  setSelectedCode: Dispatch<SetStateAction<string | null>>;
  statusLabel: (row: ReservationDoc) => "Scaduta" | "Nuova" | "In attesa" | "Confermata" | "Annullata dal cliente" | "Rifiutata";
};

/** Prenotazioni da gestire (in attesa e proposte). */
export function OpenReservationsGroup({
  highlightedCode,
  openRows,
  setSelectedCode,
  statusLabel,
}: OpenReservationsGroupProps) {
  return (
    <div className="admin-reservation-group">
      <h4>Da gestire</h4>
      {openRows.length === 0 ? (
        <p className="section-subtitle">
          Nessuna prenotazione da gestire.
        </p>
      ) : (
        <div className="admin-reservation-list">
          {openRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={
                highlightedCode === row.code
                  ? "admin-reservation-item highlighted"
                  : "admin-reservation-item"
              }
              onClick={() => setSelectedCode(row.code)}
            >
              <span className="admin-reservation-main">
                <strong>{row.customerName}</strong>
                <small>
                  {row.date} · {row.time} · {row.guests} persone
                </small>
              </span>
              <span className={`badge ${row.status}`}>
                {statusLabel(row)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
