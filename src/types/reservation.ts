export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "proposed";

export type DiningArea = "inside" | "outside";

export type ReservationInput = {
  customerName: string;
  phone: string;
  email: string;
  diningArea: DiningArea;
  date: string;
  time: string;
  guests: number;
  notes?: string;
};

export type ReservationDoc = ReservationInput & {
  id?: string;
  code: string;
  status: ReservationStatus;
  ownerResponse: string;
  proposedDate?: string;
  proposedTime?: string;
  reservationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReservationSettings = {
  openTime: string;
  closeTime: string;
  slotMinutes: 15 | 30;
  capacityPerSlot: number;
  insideActive: boolean;
  outsideActive: boolean;
  insideCapacityPerSlot: number;
  outsideCapacityPerSlot: number;
  workingDays: number[];
  holidays: string[];
  specialOpenings: string[];
};
