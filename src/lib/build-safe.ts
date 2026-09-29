/**
 * Per i dati letti da Firestore durante la build (menu, orari): un errore non
 * deve bloccare il deploy. La pagina esce senza quei dati e si rigenera alla
 * prima occasione. A sito avviato invece l'errore si propaga, così Next
 * continua a servire l'ultima versione buona invece di una pagina vuota.
 */
export const tolerateBuildErrors = async <T>(
  load: () => Promise<T>,
  label: string,
): Promise<T | null> => {
  try {
    return await load();
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error;
    console.warn(
      `[${label}] Firestore non raggiungibile durante la build, la pagina verrà rigenerata.`,
      error,
    );
    return null;
  }
};
