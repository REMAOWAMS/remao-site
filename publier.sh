#!/bin/sh
# Rattrapage manuel de la pregeneration, a lancer juste apres avoir publie un
# article, une edition ou un travail depuis admin.html.
#
# Pourquoi ce script existe. La pregeneration part normalement toute seule a la
# publication, par le declencheur SQL pose dans Supabase le 18 aout 2026 (voir
# WEBHOOK.md). Ce script est le filet : jeton GitHub expire, pg_net indisponible,
# ou simple envie de ne pas attendre. Sans lui, le seul recours est le calendrier
# de GitHub, qui honore le "toutes les 15 minutes" declare environ une fois par
# heure : le 18 aout, l'article du Benin publie a 13h33 UTC n'avait toujours pas
# de page a lui trente minutes plus tard, et son partage sortait sans miniature.
#
# La sequence sure, quand on doute :
#   1. publier depuis admin.html
#   2. lancer ce script
#   3. attendre le "PAGE EN LIGNE" ci-dessous
#   4. seulement alors, partager le lien
#
# Partager avant que la page existe est le piege : WhatsApp garde en memoire le
# premier apercu vu d'une adresse, parfois plusieurs jours. Voir WEBHOOK.md pour
# la parade (debogueur Facebook, ou ?v=2 au bout de l'adresse).
cd "$(dirname "$0")" || exit 1

echo "--- Mise a jour depuis GitHub"
git pull --ff-only || { echo "Erreur : pull impossible. Regler l'etat du depot d'abord." >&2; exit 1; }

echo "--- Regeneration des pages"
sh sync-pages.sh || exit 1
node prerender.mjs || exit 1

if git diff --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "--- Rien de nouveau : toutes les pages existaient deja."
  exit 0
fi

echo "--- Envoi"
git add -A
git commit -m "Pregeneration des pages de contenu (lancee a la main)" || exit 1
git push || exit 1

echo "--- Mise en ligne demandee. GitHub Pages met une a deux minutes."
echo "    Verifier avant de partager : l'adresse de l'article doit repondre 200,"
echo "    pas 404 :"
echo "      curl -s -o /dev/null -w '%{http_code}\n' https://remao.org/actualites/<identifiant>/"
