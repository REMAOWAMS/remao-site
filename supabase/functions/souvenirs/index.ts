// Fonction Supabase « souvenirs » : autorise les envois de la page remao.org/souvenirs/.
//
// Les vidéos ne transitent pas par Supabase : la fonction signe des adresses d'envoi
// temporaires vers le bucket Backblaze B2 (API compatible S3), et le navigateur y dépose
// le fichier lui-même, par morceaux de 8 Mo. Un morceau perdu se renvoie seul, et un
// envoi interrompu reprend là où il s'était arrêté.
//
// Secrets à déclarer dans Supabase (Edge Functions > Secrets), jamais dans le code :
//   B2_KEY_ID, B2_APP_KEY
// Facultatifs, valeurs par défaut ci-dessous : B2_BUCKET, B2_ENDPOINT
//
// Déploiement : npx supabase functions deploy souvenirs --no-verify-jwt --project-ref aohfgaxmahcowatzlvyi
// (--no-verify-jwt : la page appelle la fonction avec la clé publishable, qui n'est pas un JWT.)

import { AwsClient } from "npm:aws4fetch@1.0.20";

const BUCKET = Deno.env.get("B2_BUCKET") ?? "remao-souvenirs-conakry-2026";
const ENDPOINT = Deno.env.get("B2_ENDPOINT") ?? "s3.us-east-005.backblazeb2.com";
const REGION = ENDPOINT.split(".")[1];

const TAILLE_MORCEAU = 8 * 1024 * 1024;
const TAILLE_MAX = 4 * 1024 * 1024 * 1024;
const VALIDITE = 24 * 3600; // durée de vie d'une adresse signée, en secondes

const ORIGINES = ["https://remao.org", "https://www.remao.org"];

const aws = new AwsClient({
  accessKeyId: (Deno.env.get("B2_KEY_ID") ?? "").trim(), // un copier-coller ajoute souvent un retour à la ligne
  secretAccessKey: (Deno.env.get("B2_APP_KEY") ?? "").trim(),
  service: "s3",
  region: REGION,
});

const base = (cle: string) => `https://${ENDPOINT}/${BUCKET}/${cle}`;

// Les clés restent en ASCII minuscule : aucun souci d'encodage dans les signatures.
function nettoyer(texte: string, max: number) {
  return (texte || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, max);
}

function horodatage() {
  // Conakry est à UTC+0 toute l'année.
  const d = new Date().toISOString();
  return d.slice(0, 10).replace(/-/g, "") + "-" + d.slice(11, 19).replace(/:/g, "");
}

async function signerMorceaux(cle: string, uploadId: string, numeros: number[]) {
  const urls: Record<number, string> = {};
  for (const n of numeros) {
    const u = new URL(base(cle));
    u.searchParams.set("partNumber", String(n));
    u.searchParams.set("uploadId", uploadId);
    u.searchParams.set("X-Amz-Expires", String(VALIDITE));
    const req = await aws.sign(u.toString(), { method: "PUT", aws: { signQuery: true } });
    urls[n] = req.url;
  }
  return urls;
}

async function morceauxRecus(cle: string, uploadId: string) {
  const recus: { n: number; etag: string; taille: number }[] = [];
  let marqueur = 0;
  for (;;) {
    const u = new URL(base(cle));
    u.searchParams.set("uploadId", uploadId);
    u.searchParams.set("max-parts", "1000");
    if (marqueur) u.searchParams.set("part-number-marker", String(marqueur));
    const r = await aws.fetch(u.toString());
    const xml = await r.text();
    if (!r.ok) throw new Error("ListParts " + r.status + " " + xml.slice(0, 200));
    for (const m of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
      const bloc = m[1];
      recus.push({
        n: Number(/<PartNumber>(\d+)</.exec(bloc)![1]),
        etag: /<ETag>([^<]+)</.exec(bloc)![1],
        taille: Number(/<Size>(\d+)</.exec(bloc)![1]),
      });
    }
    if (!/<IsTruncated>true</.test(xml)) break;
    marqueur = Number(/<NextPartNumberMarker>(\d+)</.exec(xml)![1]);
  }
  return recus;
}

const nbMorceaux = (taille: number) => Math.max(1, Math.ceil(taille / TAILLE_MORCEAU));
const tous = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Une clé de reprise doit venir de cette fonction : elle porte un horodatage et un dossier pays.
const cleValide = (cle: unknown) =>
  typeof cle === "string" && /^[a-z0-9-]{1,40}\/\d{8}-\d{6}_[a-z0-9._-]{1,140}$/.test(cle);

async function demarrer(c: Record<string, unknown>) {
  const taille = Number(c.taille);
  const type = String(c.type || "");
  if (!Number.isFinite(taille) || taille <= 0) return { erreur: "Fichier vide." };
  if (taille > TAILLE_MAX) return { erreur: "Ce fichier dépasse 4 Go." };
  if (!/^(video|image)\//.test(type)) return { erreur: "Seules les vidéos et les photos sont acceptées." };

  const pays = nettoyer(String(c.pays || ""), 40) || "non-precise";
  const prenom = nettoyer(String(c.prenom || ""), 40);
  let nom = nettoyer(String(c.nom || ""), 90) || "fichier";
  if (!/\.[a-z0-9]{2,5}$/.test(nom)) nom += "." + (type.split("/")[1] || "bin").replace(/[^a-z0-9]/g, "").slice(0, 5);
  const cle = `${pays}/${horodatage()}_${prenom ? prenom + "_" : ""}${nom}`;

  const r = await aws.fetch(base(cle) + "?uploads", { method: "POST", headers: { "Content-Type": type } });
  const xml = await r.text();
  if (!r.ok) throw new Error("CreateMultipartUpload " + r.status + " " + xml.slice(0, 200));
  const uploadId = /<UploadId>([^<]+)</.exec(xml)![1];

  const n = nbMorceaux(taille);
  return { cle, uploadId, tailleMorceau: TAILLE_MORCEAU, urls: await signerMorceaux(cle, uploadId, tous(n)) };
}

async function reprendre(c: Record<string, unknown>) {
  const cle = c.cle as string, uploadId = String(c.uploadId || "");
  const n = nbMorceaux(Number(c.taille));
  const recus = await morceauxRecus(cle, uploadId);
  const faits = new Set(recus.map((p) => p.n));
  const restants = tous(n).filter((i) => !faits.has(i));
  return { faits: [...faits], urls: await signerMorceaux(cle, uploadId, restants) };
}

async function terminer(c: Record<string, unknown>) {
  const cle = c.cle as string, uploadId = String(c.uploadId || "");
  const n = nbMorceaux(Number(c.taille));
  const recus = (await morceauxRecus(cle, uploadId)).sort((a, b) => a.n - b.n);
  if (recus.length !== n) return { erreur: "Envoi incomplet.", manquants: n - recus.length };

  const corps = "<CompleteMultipartUpload>" +
    recus.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("") +
    "</CompleteMultipartUpload>";
  const u = new URL(base(cle));
  u.searchParams.set("uploadId", uploadId);
  const r = await aws.fetch(u.toString(), { method: "POST", body: corps, headers: { "Content-Type": "application/xml" } });
  const xml = await r.text();
  if (!r.ok || /<Error>/.test(xml)) throw new Error("CompleteMultipartUpload " + r.status + " " + xml.slice(0, 200));
  return { ok: true };
}

Deno.serve(async (req) => {
  const origine = req.headers.get("Origin") ?? "";
  const entetes = {
    "Access-Control-Allow-Origin": ORIGINES.includes(origine) ? origine : ORIGINES[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: entetes });
  if (req.method !== "POST") return new Response("{}", { status: 405, headers: entetes });

  try {
    const c = await req.json();
    let rep;
    if (c.action === "demarrer") rep = await demarrer(c);
    else if ((c.action === "reprendre" || c.action === "terminer") && cleValide(c.cle) && c.uploadId) {
      rep = c.action === "reprendre" ? await reprendre(c) : await terminer(c);
    } else rep = { erreur: "Requête invalide." };
    return new Response(JSON.stringify(rep), { status: rep.erreur ? 400 : 200, headers: entetes });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ erreur: "Le serveur n'a pas pu traiter l'envoi." }), { status: 502, headers: entetes });
  }
});
