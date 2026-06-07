import { ReservationForm } from "@/components/reservation-form";

export const metadata = {
  title: "Prenotazioni | Duecento Grammi",
};

export default function BookingPage() {
  return (
    <main className="page-main bookings-page-compact bookings-shell">
      <div className="container bookings-compact-grid-single bookings-center-wrap">
        <ReservationForm />
      </div>
    </main>
  );
}
