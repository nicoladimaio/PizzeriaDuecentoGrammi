"use client";

import { useState } from "react";
import { ReservationStatusChecker } from "@/components/reservation-status";

export function ReservationStatusPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-secondary status-popup-trigger"
        onClick={() => setOpen(true)}
      >
        Controlla prenotazione
      </button>

      {open ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal status-popup-modal">
            <div className="admin-modal-head">
              <h3>Stato prenotazione</h3>
              <button
                type="button"
                className="admin-mini-btn"
                onClick={() => setOpen(false)}
              >
                Chiudi
              </button>
            </div>
            <ReservationStatusChecker compact />
          </div>
        </div>
      ) : null}
    </>
  );
}
