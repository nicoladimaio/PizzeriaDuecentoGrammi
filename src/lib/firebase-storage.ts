import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getClientApp } from "@/lib/firebase";

/** Archivio foto dei piatti: usato solo dal pannello menu. */
export const getClientStorage = (): FirebaseStorage =>
  getStorage(getClientApp());
