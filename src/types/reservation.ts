export type ReservationStatus = "pending" | "confirmed" | "rejected";

export type ReservationInput = {
  customerName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
};

export type ReservationDoc = ReservationInput & {
  code: string;
  status: ReservationStatus;
  ownerResponse: string;
  createdAt: string;
  updatedAt: string;
};
