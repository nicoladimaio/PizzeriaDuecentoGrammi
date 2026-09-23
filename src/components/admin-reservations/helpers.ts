import type { QueryDocumentSnapshot } from "firebase/firestore";
import type { ReservationDoc } from "@/types/reservation";
import type { ActionType } from "@/components/admin-reservations/types";

export const defaultRejectMessage =
  "Non riusciamo a garantirti il posto prenotato per l'orario richiesto. Ti invitiamo a riprovare con una nuova richiesta.";

export const defaultCancelConfirmedMessage =
  "La tua prenotazione confermata e stata annullata. Se vuoi, contattaci per concordare una nuova disponibilita.";

export const defaultProposalMessage =
  "Ti proponiamo un orario alternativo disponibile: se per te va bene, confermalo dal pulsante in email.";

export const proposalDatesPageSize = 8;

export const TOTAL_SEATS_FALLBACK = 80;

export const HISTORY_RETENTION_DAYS = 14;

export const actionLoadingLabel = (action: ActionType | null) => {
  switch (action) {
    case "confirmed":
      return "Conferma prenotazione in corso...";
    case "rejected":
      return "Rifiuto prenotazione in corso...";
    case "proposed":
      return "Invio proposta in corso...";
    case "delete":
      return "Eliminazione prenotazione in corso...";
    default:
      return "Operazione in corso...";
  }
};

export const mapSnapshot = (
  snap: QueryDocumentSnapshot,
): ReservationDoc & { id: string } => {
  const data = snap.data() as ReservationDoc;
  return {
    ...data,
    diningArea: data.diningArea === "outside" ? "outside" : "inside",
    arrived: data.arrived === true,
    id: snap.id,
  };
};

export const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const rawText = await response.text();

  if (!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      `Il server ha restituito una risposta non valida${
        response.status ? ` (HTTP ${response.status})` : ""
      }.`,
    );
  }
};
