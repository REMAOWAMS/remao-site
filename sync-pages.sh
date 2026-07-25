#!/bin/sh
# GitHub Pages ne sait pas reecrire les URL. Pour que /assises/ reponde 200 (et non 404,
# ce qui casserait les apercus WhatsApp et le referencement), chaque vue a son propre
# dossier contenant une copie d'index.html. 404.html couvre le reste : articles et
# editions d'Assises, dont les adresses dependent d'identifiants dynamiques.
#
# Chaque copie recoit en plus son propre titre, sa description et son adresse canonique :
# le bloc situe entre <!-- SEO:DEBUT --> et <!-- SEO:FIN --> dans index.html est remplace
# page par page. C'est indispensable : les robots de WhatsApp, Facebook et LinkedIn
# n'executent pas le JavaScript, ils ne lisent que le HTML livre tel quel. Les titres
# se modifient ici, dans les listes ci-dessous, et nulle part ailleurs.
#
# Le script produit aussi sitemap.xml et robots.txt.
#
# index.html n'est jamais modifie : le bloc SEO qu'il porte est celui de l'accueil.
#
# A EXECUTER APRES CHAQUE MODIFICATION D'index.html.
cd "$(dirname "$0")" || exit 1

SITE="https://remao.org"
BLOC=".seo-bloc.tmp"
JOUR=$(date +%Y-%m-%d)
NB=0

if ! grep -q '^<!-- SEO:DEBUT -->$' index.html; then
  echo "Erreur : les marqueurs SEO:DEBUT / SEO:FIN ont disparu d'index.html." >&2
  exit 1
fi

# Ecrit une copie d'index.html en y remplacant le bloc SEO.
#   $1 dossier de destination, relatif a la racine du site
#   $2 titre de la page
#   $3 description : resultats Google et apercu de partage
#   $4 fichier de lignes a ajouter au bloc, facultatif (donnees structurees, noindex)
poser() {
  dest="$1"; titre="$2"; desc="$3"; extra="$4"
  url="$SITE/$dest/"
  mkdir -p "$dest" || return 1
  {
    printf '<title>%s</title>\n' "$titre"
    printf '<meta name="description" content="%s">\n' "$desc"
    printf '<link rel="canonical" href="%s">\n' "$url"
    printf '<meta property="og:title" content="%s">\n' "$titre"
    printf '<meta property="og:description" content="%s">\n' "$desc"
    printf '<meta property="og:url" content="%s">\n' "$url"
    printf '<meta property="og:type" content="website">\n'
    printf '<meta property="og:image" content="%s/og-image.jpg">\n' "$SITE"
    printf '<meta property="og:image:width" content="1200">\n'
    printf '<meta property="og:image:height" content="630">\n'
    if [ -n "$extra" ] && [ -f "$extra" ]; then cat "$extra"; fi
  } > "$BLOC"
  awk -v bloc="$BLOC" '
    $0 == "<!-- SEO:DEBUT -->" { print; while((getline l < bloc) > 0) print l; close(bloc); saut=1; next }
    $0 == "<!-- SEO:FIN -->"   { saut=0 }
    !saut                      { print }
  ' index.html > "$dest/index.html"
  NB=$((NB+1))
}

# Toute adresse inconnue retombe ici : articles, travaux de la revue, editions
# archivees. L'en-tete generique de l'accueil est le seul qui convienne, le contenu
# de ces pages n'etant connu qu'apres chargement depuis Supabase.
cp index.html 404.html

# ---------------------------------------------------------------------------
# Les vues qui ont leur propre adresse
# ---------------------------------------------------------------------------
while IFS='|' read -r dossier titre desc; do
  [ -z "$dossier" ] && continue
  poser "$dossier" "$titre" "$desc"
done <<'VUES'
qui-sommes-nous|Qui sommes-nous — REMAO|Histoire du REMAO depuis sa fondation en 1997 à Ouagadougou, mission du réseau et composition du Bureau Exécutif.
assises|Assises du REMAO|Le grand rendez-vous annuel du réseau : congrès scientifique, compétitions sportives et soirées culturelles réunissant les délégations des huit pays membres.
revue|Revue scientifique — REMAO|Les travaux scientifiques des étudiants présentés aux Assises du REMAO, rangés par édition.
palmares|Palmarès des Assises — REMAO|Les lauréats de chaque édition des Assises du REMAO : communications scientifiques, jeu génie, compétitions sportives et distinctions culturelles.
actualites|Actualités — REMAO|Communiqués officiels, vie du réseau et actualités des cellules nationales du REMAO.
devenir-membre|Devenir membre — REMAO|Rejoindre le REMAO en passant par la cellule nationale de son pays. Les contacts des huit délégations.
creer-une-cellule|Créer une cellule nationale — REMAO|La démarche pour créer une cellule du REMAO dans son pays et rejoindre le réseau.
VUES

# La page des Assises est ensuite reecrite par prerender.mjs, qui lui donne le titre,
# l'affiche et la fiche evenement de l'edition mise en avant, telle qu'elle est saisie
# dans l'administration. L'en-tete neutre ci-dessus est ce qui reste si la base est
# injoignable : rien de faux, seulement moins precis.

# ---------------------------------------------------------------------------
# Les huit cellules nationales
# ---------------------------------------------------------------------------
# La preposition est portee par la liste : on dit « en Cote d'Ivoire » et « en Guinee »,
# mais « au Benin ». Les deux pays feminins du reseau font exception.
while IFS='|' read -r code nom prep cap activite; do
  [ -z "$code" ] && continue
  poser "pays/$code" "Cellule REMAO $nom — $cap" \
    "La délégation du REMAO $prep $nom, basée à $cap. $activite."
done <<'PAYS'
bj|Bénin|au|Cotonou|Journées scientifiques et projets de santé communautaire
bf|Burkina Faso|au|Ouagadougou|Pays fondateur du réseau, en 1997
ci|Côte d'Ivoire|en|Abidjan|Hôte des 19es Assises, à Bouaké
gn|Guinée|en|Conakry|Hôte des 21es Assises, à Conakry en 2026
ml|Mali|au|Bamako|Campagnes de terrain et actions de santé publique
ne|Niger|au|Niamey|Siège du réseau et hôte des 18es Assises
sn|Sénégal|au|Dakar|Hôte des 20es Assises, à Thiès en 2025
tg|Togo|au|Lomé|Engagement culturel et fraternité du réseau
PAYS

# /pays sans code de pays ne montre aucune cellule : le fichier n'existe que pour
# repondre 200, le site renvoie aussitot a l'accueil. Rien a indexer, d'ou le noindex,
# et l'adresse canonique ramenee sur l'accueil.
printf '<meta name="robots" content="noindex">\n' > .seo-noindex.tmp
poser "pays" "REMAO — Réseau des Étudiants en Médecine de l'Afrique de l'Ouest" \
  "Les huit cellules nationales du REMAO." .seo-noindex.tmp
sed -i 's|<link rel="canonical" href="https://remao.org/pays/">|<link rel="canonical" href="https://remao.org/">|' pays/index.html

# ---------------------------------------------------------------------------
# Plan du site et robots
# ---------------------------------------------------------------------------
# admin.html reste hors du plan, et n'est pas interdit ici : la page porte deja un
# noindex, que Google ne pourrait pas lire si on lui en interdisait l'acces.
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  for u in "" "qui-sommes-nous/" "assises/" "palmares/" "revue/" "actualites/" "devenir-membre/" "creer-une-cellule/" \
           "pays/bj/" "pays/bf/" "pays/ci/" "pays/gn/" "pays/ml/" "pays/ne/" "pays/sn/" "pays/tg/"; do
    printf '  <url><loc>%s/%s</loc><lastmod>%s</lastmod></url>\n' "$SITE" "$u" "$JOUR"
  done
  echo '</urlset>'
} > sitemap.xml

cat > robots.txt <<ROBOTS
User-agent: *
Allow: /

Sitemap: $SITE/sitemap.xml
ROBOTS

rm -f "$BLOC" .seo-noindex.tmp

echo "Pages regenerees : 404.html + $NB pages avec leur propre en-tete, sitemap.xml, robots.txt"
