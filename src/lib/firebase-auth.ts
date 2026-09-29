import { getAuth, type Auth } from "firebase/auth";
import { getClientApp } from "@/lib/firebase";

/** Login Firebase: usato solo dall'area riservata. */
export const getClientAuth = (): Auth => getAuth(getClientApp());
