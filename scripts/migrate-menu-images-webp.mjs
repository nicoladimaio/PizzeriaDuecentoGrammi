#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const cwd = process.cwd();

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq < 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, "\n");
  return { key, value };
};

const loadEnvFromFile = (fileName) => {
  const filePath = path.join(cwd, fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const pair = parseEnvLine(line);
    if (!pair) return;
    if (!process.env[pair.key]) {
      process.env[pair.key] = pair.value;
    }
  });
};

loadEnvFromFile(".env.local");
loadEnvFromFile(".env");

const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];
required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Variabile mancante: ${key}`);
  }
});

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

const dryRun = process.argv.includes("--dry");
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const hasLimit = Boolean(limitArg);
const limit = hasLimit ? Number(limitArg.split("=")[1]) : Infinity;

if (hasLimit && (!Number.isFinite(limit) || limit <= 0)) {
  throw new Error("--limit deve essere un numero positivo");
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
}

const db = getFirestore();
const bucket = getStorage().bucket(storageBucket);

const isRemoteHttp = (value) => /^https?:\/\//i.test(value);
const isGsPath = (value) => value.startsWith("gs://");
const isLocalAsset = (value) =>
  value.startsWith("assets/") || value.startsWith("/assets/");

const decodeStoragePathFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
};

const makeDownloadUrl = (bucketName, objectPath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

const fetchSourceBuffer = async (rawImage) => {
  if (isGsPath(rawImage)) {
    const objectPath = rawImage.replace(`gs://${storageBucket}/`, "");
    const [buffer] = await bucket.file(objectPath).download();
    return buffer;
  }

  if (isRemoteHttp(rawImage)) {
    const maybePath = decodeStoragePathFromUrl(rawImage);
    if (maybePath) {
      try {
        const [buffer] = await bucket.file(maybePath).download();
        return buffer;
      } catch {
        // fallback su fetch diretto
      }
    }

    const response = await fetch(rawImage);
    if (!response.ok) {
      throw new Error(`Download fallito: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error("Formato immagine non supportato");
};

const optimizeBuffers = async (sourceBuffer) => {
  const full = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(full)
    .resize({
      width: 560,
      height: 560,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 74 })
    .toBuffer();

  return { full, thumb };
};

const uploadWithToken = async (objectPath, buffer) => {
  const token = randomUUID();
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    resumable: false,
    contentType: "image/webp",
    metadata: {
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  return makeDownloadUrl(storageBucket, objectPath, token);
};

const run = async () => {
  console.log("[webp-migrate] Avvio migrazione menu_items...");
  console.log(
    `[webp-migrate] Modalita: ${dryRun ? "DRY-RUN" : "WRITE"} | force=${force} | limit=${Number.isFinite(limit) ? limit : "∞"}`,
  );

  const snapshot = await db.collection("menu_items").get();
  const docs = snapshot.docs.slice(
    0,
    Number.isFinite(limit) ? limit : undefined,
  );

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    const data = doc.data() || {};
    const rawImage = String(data.immagine ?? data.Immagine ?? "").trim();
    const rawThumb = String(
      data.immagineThumb ?? data.ImmagineThumb ?? data.imageThumb ?? "",
    ).trim();

    if (!rawImage || isLocalAsset(rawImage)) {
      skipped += 1;
      continue;
    }

    const alreadyWebp = /\.webp(\?|$)/i.test(rawImage);
    if (!force && alreadyWebp && rawThumb) {
      skipped += 1;
      continue;
    }

    try {
      const source = await fetchSourceBuffer(rawImage);
      const optimized = await optimizeBuffers(source);
      const stamp = Date.now();
      const fullPath = `menu-items/optimized/${doc.id}-${stamp}.webp`;
      const thumbPath = `menu-items/optimized/thumbs/${doc.id}-${stamp}.webp`;

      if (dryRun) {
        console.log(`[dry] ${doc.id} -> ${fullPath} + ${thumbPath}`);
        processed += 1;
        continue;
      }

      const [fullUrl, thumbUrl] = await Promise.all([
        uploadWithToken(fullPath, optimized.full),
        uploadWithToken(thumbPath, optimized.thumb),
      ]);

      const payload = {
        immagine: fullUrl,
        immagineThumb: thumbUrl,
        updatedAt: new Date().toISOString(),
      };

      if (!data.immagineOriginal) {
        payload.immagineOriginal = rawImage;
      }

      await db.collection("menu_items").doc(doc.id).update(payload);

      processed += 1;
      console.log(`[ok] ${doc.id} aggiornato`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[err] ${doc.id}: ${message}`);
    }
  }

  console.log("[webp-migrate] Completato");
  console.log(
    `[webp-migrate] processed=${processed} skipped=${skipped} failed=${failed}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[webp-migrate] fatal: ${message}`);
  process.exit(1);
});
