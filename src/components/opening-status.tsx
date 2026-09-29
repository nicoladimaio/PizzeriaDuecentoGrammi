"use client";

import { useSyncExternalStore } from "react";
import { getOpeningStatus, type OpeningHours } from "@/lib/opening-hours";
import { getRomeNow } from "@/lib/rome-time";

// "Aperti ora" dipende dall'ora esatta, mentre la home è in cache fino a 10
// minuti: lo stato si calcola nel browser (ora italiana) e si aggiorna ogni
// minuto. Sul server non si mostra nulla, così non c'è differenza tra HTML
// e pagina idratata.

const subscribeToMinutes = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};
const getCurrentMinute = () => Math.floor(Date.now() / 60_000);
const getServerMinute = () => null;

export function OpeningStatus({ hours }: { hours: OpeningHours }) {
  const minute = useSyncExternalStore(
    subscribeToMinutes,
    getCurrentMinute,
    getServerMinute,
  );
  if (minute === null) return null;

  const status = getOpeningStatus(hours, getRomeNow(new Date(minute * 60_000)));
  if (!status) return null;

  return (
    <span className={`home-footer-status home-footer-status-${status.kind}`}>
      {status.text}
    </span>
  );
}
