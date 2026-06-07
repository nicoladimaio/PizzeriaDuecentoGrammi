export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "proposed";

export type ReservationInput = {
  customerName: string;
  phone: string;
  email?: string;
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
  notificationPhone?: string;
  reservationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReservationSettings = {
  openTime: string;
  closeTime: string;
  slotMinutes: 15 | 30;
  capacityPerSlot: number;
  workingDays: number[];
  holidays: string[];
  specialOpenings: string[];
};
