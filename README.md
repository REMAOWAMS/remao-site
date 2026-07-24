# Site officiel du REMAO

Site web officiel du **Réseau des Étudiants en Médecine de l'Afrique de l'Ouest (REMAO / WAMS-Web)**.

Site statique (HTML/CSS/JS) adossé à Supabase pour les contenus et l'espace d'administration. Identité dérivée du sceau officiel du réseau.

- Site public : https://remao.org/
- Administration : https://remao.org/admin.html

## Pages
- Accueil (chiffres clés, Assises, délégations, actualités, adhésion)
- Qui sommes-nous (histoire, mission, Bureau Exécutif)
- Assises du REMAO (Conakry 2026)
- Revue scientifique (travaux des étudiants, rangés par édition des Assises)
- Actualités et articles
- Pages pays (8 délégations)
- Devenir membre / Créer une cellule

## Contenus

Tout le contenu éditorial se modifie depuis l'administration, sans toucher au code :
actualités, pages des cellules nationales, membres du Bureau, éditions des Assises,
travaux de la revue scientifique, documents officiels, partenaires et images du site.

Un travail de la revue se rattache à une édition des Assises : c'est ce lien qui range
la page `/revue/` par édition. Créer d'abord l'édition, puis les travaux.

L'accès est réservé aux comptes créés par le Bureau. Les inscriptions publiques sont
désactivées : un nouveau compte se crée dans Supabase, Authentication > Users, en
cochant « Auto Confirm User ».

## Référencement et partage

Chaque page a son propre titre, sa description, son adresse canonique et son aperçu de
partage. Ils ne sont pas écrits dans `index.html` mais dans les listes de
[`sync-pages.sh`](sync-pages.sh), qui les injecte dans chaque page à la génération. Le
script produit aussi `sitemap.xml` et `robots.txt`.

**Après toute modification d'`index.html`, lancer `./sync-pages.sh`** : sans cela les
autres pages restent sur l'ancienne version du site.

Les articles et les travaux de la revue ont une adresse tirée de la base : aucun fichier
ne leur est dédié, ils passent par `404.html`. Leur titre est posé par le JavaScript, ce
que Google lit, mais pas les robots de WhatsApp ni de Facebook. Un article partagé affiche
donc l'aperçu générique du site. Y remédier suppose de prégénérer une page par article
depuis Supabase, à automatiser par une GitHub Action.

## Mise en ligne

Hébergé gratuitement par **GitHub Pages** depuis la branche `main`. Toute modification
poussée sur `main` est en ligne une à deux minutes plus tard.

Après la première mise en ligne du plan du site, le déclarer une fois dans
[Google Search Console](https://search.google.com/search-console) : `https://remao.org/sitemap.xml`.

## Passation

Le site appartient au réseau, pas à un bureau. La procédure de transmission des comptes
(GitHub, Supabase, administration) est décrite dans [MIGRATION.md](MIGRATION.md).

## À compléter

Coordonnées et photos des responsables des cellules nationales, à recueillir auprès des
délégations, et fichier vectoriel source du logo.
