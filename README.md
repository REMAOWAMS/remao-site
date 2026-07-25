# Site officiel du REMAO

Site web officiel du **Réseau des Étudiants en Médecine de l'Afrique de l'Ouest (REMAO / WAMS-Web)**.

Site statique (HTML/CSS/JS) adossé à Supabase pour les contenus et l'espace d'administration. Identité dérivée du sceau officiel du réseau.

- Site public : https://remao.org/
- Administration : https://remao.org/admin.html

## Pages
- Accueil (chiffres clés, Assises, délégations, actualités, adhésion)
- Qui sommes-nous (histoire, mission, Bureau Exécutif)
- Assises du REMAO (Conakry 2026)
- Palmarès (les lauréats de chaque édition, épreuve par épreuve)
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

Le palmarès se saisit dans la fiche de l'édition : une épreuve, puis ses lauréats dans
l'ordre du podium. Le rang laissé vide se numérote seul, 1er, 2e, 3e, et prend la couleur
de la médaille ; écrit à la main, « Miss REMAO » ou « Prix du jury », il s'affiche tel
quel, sans médaille. Tant qu'aucun lauréat n'est saisi, ni la section de l'édition ni la
ligne de la page `/palmares/` n'existent.

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

Les articles, les travaux de la revue et les éditions des Assises ont une adresse tirée de
la base. [`prerender.mjs`](prerender.mjs) interroge Supabase et écrit un vrai fichier pour
chacun, avec son titre, son résumé et sa photo. Il complète le plan du site et supprime
les pages des contenus effacés depuis l'administration.

Ce script tourne tout seul **toutes les heures**, par la GitHub Action
[`prerender.yml`](.github/workflows/prerender.yml). Le Bureau publie depuis
l'administration, sans rien faire de plus : l'aperçu de partage devient correct dans
l'heure. Pour un communiqué urgent, onglet **Actions** du dépôt, workflow
« Pregeneration des pages », bouton **Run workflow**, et c'est en ligne en deux minutes.

La page `/assises/` et chaque édition portent une fiche événement lue par Google. Elle est
construite à partir de la fiche saisie dans l'administration : titre, affiche, ville,
thème, date d'ouverture et date de clôture. Rien à modifier dans le code au changement
d'édition. Si la date de clôture n'est pas renseignée, elle est déduite du texte des
dates, « du 13 au 22 octobre 2026 ».

En local, l'ordre est le même que celui de l'Action :

```sh
./sync-pages.sh && node prerender.mjs
```

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
