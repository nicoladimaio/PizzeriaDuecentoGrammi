export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "proposed"
  | "cancelled";

export type ReservationInput = {
  customerName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
  privacyAcknowledged?: boolean;
  bookingTermsAccepted?: boolean;
  privacyPolicyVersion?: string;
  bookingTermsVersion?: string;
  legalAcceptedAt?: string;
};

export type ReservationDoc = ReservationInput & {
  id?: string;
  code: string;
  status: ReservationStatus;
  arrived?: boolean;
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
  slotMinutes: number;
  capacityPerSlot: number;
  workingDays: number[];
  holidays: string[];
  specialOpenings: string[];
  weeklyDisabledSlots: Record<string, string[]>;
};
