/* ===========================================================================
   Prégénération des pages dont l'adresse dépend d'un identifiant de la base :
   articles d'actualité, travaux de la revue, éditions des Assises.

   Pourquoi. Ces pages n'existent pas comme fichiers : GitHub Pages renvoie
   404.html et c'est le JavaScript qui va chercher le contenu dans Supabase.
   Un humain ne voit rien d'anormal. Le robot de WhatsApp, de Facebook ou de
   LinkedIn, lui, n'exécute pas le JavaScript : il ne voit que l'en-tête
   générique du site. Un article partagé dans un groupe s'affiche donc sans son
   titre ni sa photo. Ce script écrit un vrai fichier par contenu, avec son
   propre en-tête, comme sync-pages.sh le fait pour les pages fixes.

   Lancement : node prerender.mjs, après sync-pages.sh.
   En pratique, la GitHub Action .github/workflows/prerender.yml s'en charge
   toutes les heures, pour que le Bureau n'ait rien à faire après publication.

   Aucune dépendance : Node 18 ou plus récent suffit.
   =========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const SITE = "https://remao.org";
const IMAGE_DEFAUT = SITE + "/og-image.jpg";
const DEBUT = "<!-- SEO:DEBUT -->";
const FIN = "<!-- SEO:FIN -->";
// Un dossier de contenu porte un identifiant Supabase. Le filtre évite qu'un
// nettoyage trop large n'emporte /pays/ci ou une autre page écrite à la main.
const IDENTIFIANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- Outils ---------- */

const chemin = (...p) => join(RACINE, ...p);

// Échappement pour un contenu d'attribut HTML.
function att(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Texte brut à partir du HTML saisi dans l'admin.
function texte(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// « XXIe Assises ... du REMAO — REMAO » : on n'ajoute le suffixe que s'il manque.
const suffixe = (t) => (/REMAO/i.test(t) ? t : `${t} — REMAO`);

// Coupe au dernier mot entier : Google reprend ce résumé tel quel.
function resumer(txt, n = 160) {
  txt = String(txt ?? "").trim();
  if (txt.length <= n) return txt;
  let bout = txt.slice(0, n);
  const esp = bout.lastIndexOf(" ");
  if (esp > n * 0.6) bout = bout.slice(0, esp);
  return bout.replace(/[\s,;:.…]+$/, "") + "…";
}

/* ---------- Lecture de la base ---------- */

function configSupabase() {
  const src = readFileSync(chemin("supabase-config.js"), "utf8");
  const url = src.match(/SUPA_URL\s*=\s*"([^"]+)"/);
  const cle = src.match(/SUPA_KEY\s*=\s*"([^"]+)"/);
  if (!url || !cle) throw new Error("supabase-config.js : URL ou clé introuvable.");
  return { url: url[1], cle: cle[1] };
}

// La clé lue est la clé publique, celle que le site expose déjà, et la lecture
// seule est la seule opération autorisée par les règles de sécurité Supabase.
async function contenus() {
  const { url, cle } = configSupabase();
  const rep = await fetch(url + "/rest/v1/contenus?select=id,type,data", {
    headers: { apikey: cle, Authorization: "Bearer " + cle }
  });
  if (!rep.ok) throw new Error("Supabase a répondu " + rep.status + " " + rep.statusText);
  const lignes = await rep.json();
  const par = {};
  for (const l of lignes) (par[l.type] = par[l.type] || []).push(l);
  return par;
}

/* ---------- Écriture des pages ---------- */

const gabarit = readFileSync(chemin("index.html"), "utf8");
if (!gabarit.includes(DEBUT) || !gabarit.includes(FIN)) {
  throw new Error("Les marqueurs SEO:DEBUT / SEO:FIN ont disparu d'index.html.");
}

function ecrirePage(dossier, { titre, description, image, type = "article", jsonld }) {
  const url = `${SITE}/${dossier}/`;
  const lignes = [
    `<title>${att(titre)}</title>`,
    `<meta name="description" content="${att(description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${att(titre)}">`,
    `<meta property="og:description" content="${att(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:image" content="${att(image || IMAGE_DEFAUT)}">`
  ];
  // Les dimensions ne sont declarées que pour l'image par défaut, la seule dont
  // on connaisse la taille. Une dimension fausse fait rejeter l'aperçu.
  if (!image || image === IMAGE_DEFAUT) {
    lignes.push('<meta property="og:image:width" content="1200">',
                '<meta property="og:image:height" content="630">');
  }
  if (jsonld) lignes.push('<script type="application/ld+json">', JSON.stringify(jsonld, null, 2), "</script>");

  const avant = gabarit.slice(0, gabarit.indexOf(DEBUT) + DEBUT.length);
  const apres = gabarit.slice(gabarit.indexOf(FIN));
  mkdirSync(chemin(dossier), { recursive: true });
  writeFileSync(chemin(dossier, "index.html"), avant + "\n" + lignes.join("\n") + "\n" + apres, "utf8");
  return url;
}

/* ---------- Nettoyage des contenus supprimés depuis l'admin ---------- */

function nettoyer(parent, gardes) {
  if (!existsSync(chemin(parent))) return 0;
  let n = 0;
  for (const entree of readdirSync(chemin(parent), { withFileTypes: true })) {
    if (!entree.isDirectory() || !IDENTIFIANT.test(entree.name)) continue;
    if (gardes.has(entree.name)) continue;
    rmSync(chemin(parent, entree.name), { recursive: true, force: true });
    n++;
  }
  return n;
}

/* ---------- Plan du site ---------- */

// Les adresses fixes viennent du sitemap écrit par sync-pages.sh : une seule
// liste, tenue à un seul endroit. On remplace seulement la partie dynamique.
function majSitemap(urls) {
  const fichier = chemin("sitemap.xml");
  const existant = existsSync(fichier) ? readFileSync(fichier, "utf8") : "";
  const fixes = [...existant.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(m => m[1])
    .filter(u => !/\/(actualites|revue|assises)\/[0-9a-f-]{36}\//i.test(u));
  const jour = new Date().toISOString().slice(0, 10);
  const toutes = [...new Set([...fixes, ...urls])];
  const corps = toutes
    .map(u => `  <url><loc>${u}</loc><lastmod>${jour}</lastmod></url>`)
    .join("\n");
  writeFileSync(fichier,
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    corps + "\n</urlset>\n", "utf8");
  return toutes.length;
}

/* ---------- Programme ---------- */

const par = await contenus();
const urls = [];
const gardes = { actualites: new Set(), revue: new Set(), assises: new Set() };

// Éditions des Assises : sert aussi à nommer l'édition d'un travail de la revue.
const editions = {};
for (const l of par.assises || []) editions[l.id] = l.data || {};

for (const l of par.actualite || []) {
  const d = l.data || {};
  const titre = d.titre || "Actualité du REMAO";
  const corps = texte(d.texte);
  urls.push(ecrirePage(`actualites/${l.id}`, {
    titre: suffixe(titre),
    description: resumer(corps) || "Actualité du Réseau des Étudiants en Médecine de l'Afrique de l'Ouest.",
    image: d.image || "",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: titre,
      datePublished: d.date || undefined,
      image: d.image || IMAGE_DEFAUT,
      articleSection: d.categorie || "Actualité",
      inLanguage: "fr",
      mainEntityOfPage: `${SITE}/actualites/${l.id}/`,
      publisher: {
        "@type": "Organization",
        name: "Réseau des Étudiants en Médecine de l'Afrique de l'Ouest",
        url: SITE + "/",
        logo: { "@type": "ImageObject", url: SITE + "/logo-web.png" }
      }
    }
  }));
  gardes.actualites.add(l.id);
}

for (const l of par.publication || []) {
  const d = l.data || {};
  const titre = d.titre || "Travail scientifique";
  const ed = editions[d.assises_id];
  const edition = ed ? (ed.titre || `${ed.numero || "?"}es Assises`) : (d.assises_label || "");
  const resume = texte(d.resume);
  const signature = [d.auteurs, d.pays ? "Cellule REMAO " + d.pays : "", edition].filter(Boolean).join(" · ");
  urls.push(ecrirePage(`revue/${l.id}`, {
    titre: `${titre} — Revue scientifique du REMAO`,
    description: resumer(resume || signature) || "Travail scientifique présenté aux Assises du REMAO.",
    image: "",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      headline: titre,
      author: d.auteurs || undefined,
      datePublished: d.date || undefined,
      inLanguage: "fr",
      isPartOf: edition || undefined,
      mainEntityOfPage: `${SITE}/revue/${l.id}/`,
      publisher: {
        "@type": "Organization",
        name: "Réseau des Étudiants en Médecine de l'Afrique de l'Ouest",
        url: SITE + "/"
      }
    }
  }));
  gardes.revue.add(l.id);
}

for (const l of par.assises || []) {
  const d = l.data || {};
  const titre = (d.titre || `${d.numero || ""}es Assises du REMAO`).replace(/\.$/, "");
  urls.push(ecrirePage(`assises/${l.id}`, {
    titre: suffixe(titre),
    description: resumer(texte(d.theme) || [d.ville, d.dates].filter(Boolean).join(", ")) ||
      "Une édition des Assises du REMAO.",
    image: d.image || "",
    type: "website"
  }));
  gardes.assises.add(l.id);
}

const retires = nettoyer("actualites", gardes.actualites)
  + nettoyer("revue", gardes.revue)
  + nettoyer("assises", gardes.assises);
const total = majSitemap(urls);

console.log(`Pages pregenerees : ${urls.length} (${gardes.actualites.size} actualites, ` +
  `${gardes.revue.size} travaux, ${gardes.assises.size} editions), ` +
  `${retires} dossier(s) obsolete(s) retire(s), sitemap a ${total} adresses.`);
