# Déclencher la prégénération à la publication

## Le problème que ça règle

Un article publié depuis `admin.html` part dans Supabase, mais le site reste un
ensemble de fichiers. Tant que `prerender.mjs` n'a pas écrit la page de l'article,
son adresse renvoie `404.html`, dont l'en-tête est celui, générique, du site
d'accueil. Conséquence visible : le lien partagé sur WhatsApp s'affiche sans son
titre ni sa photo. Les robots de WhatsApp, Facebook et LinkedIn n'exécutent pas le
JavaScript, ils ne lisent que le HTML livré tel quel.

La prégénération tournait sur le seul calendrier de GitHub. Or GitHub honore mal
les `schedule` sur les dépôts peu actifs. Le 28 juillet 2026, une prégénération
déclarée horaire n'a tourné qu'à 17h22, 21h53 puis 07h58 : plus de six heures de
trou, pendant lesquelles tout article publié se partageait sans miniature.

Le calendrier reste, en filet. Le déclencheur fiable est ce webhook.

## Ce qu'il faut faire, une seule fois

### 1. Créer un jeton GitHub

Sur github.com, connecté au compte **REMAOWAMS** :

Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
*Generate new token*.

- Nom : `webhook-supabase-pregeneration`
- Resource owner : REMAOWAMS
- Repository access : *Only select repositories* → `remao-site`
- Permissions → Repository permissions → **Contents : Read and write**
- Expiration : la plus longue proposée. **Noter la date d'échéance** : le jour où le
  jeton expire, les miniatures cessent silencieusement de se mettre à jour.

Copier le jeton affiché. Il ne sera plus jamais montré.

Ce jeton ne donne accès qu'à ce dépôt. Il ne doit jamais être collé dans
`admin.html`, ni dans aucun fichier du site : tout ce qui est servi par le site est
public, un jeton qui s'y trouve est un jeton perdu.

### 2. Créer le webhook Supabase

Sur supabase.com, projet `aohfgaxmahcowatzlvyi` :

Database → **Webhooks** → *Create a new hook*.

- Name : `pregeneration-github`
- Table : `contenus`
- Events : cocher **Insert**, **Update**, **Delete**
- Type : **HTTP Request**
- Method : `POST`
- URL : `https://api.github.com/repos/REMAOWAMS/remao-site/dispatches`
- HTTP Headers :

  | Nom | Valeur |
  |---|---|
  | `Authorization` | `Bearer LE_JETON_COPIE_A_L_ETAPE_1` |
  | `Accept` | `application/vnd.github+json` |
  | `Content-Type` | `application/json` |

- HTTP Params : aucun
- Payload / body :

  ```json
  { "event_type": "contenu-publie" }
  ```

Enregistrer.

### 3. Vérifier

Publier ou modifier n'importe quel contenu depuis `admin.html`, puis ouvrir
l'onglet **Actions** du dépôt. Une exécution « Pregeneration des pages » doit
apparaître dans la minute, avec `repository_dispatch` comme déclencheur.

Compter ensuite deux à trois minutes : le temps que la page soit écrite, poussée,
et que GitHub Pages remette le site en ligne.

## Après publication, si la miniature manque encore

WhatsApp garde en mémoire le premier aperçu qu'il a vu d'une adresse, parfois
plusieurs jours. Un lien partagé **avant** que la page existe restera donc sans
miniature, même une fois la page écrite.

Deux parades :

- passer l'adresse dans le [débogueur de partage Facebook](https://developers.facebook.com/tools/debug/)
  et cliquer *Scrape Again*, ce qui vide aussi le cache utilisé par WhatsApp ;
- à défaut, partager l'adresse avec un paramètre inutilisé, par exemple
  `?v=2` à la fin : c'est une nouvelle adresse pour le robot, l'aperçu est refait.

Le réflexe, dans l'ordre : publier, attendre trois minutes, **puis** partager.

## Rattrapage sans webhook

Si le webhook est hors service, la prégénération se lance à la main : onglet
Actions du dépôt → *Pregeneration des pages* → **Run workflow**.

En local, depuis `remao-site/` :

```bash
sh sync-pages.sh && node prerender.mjs
```

puis committer et pousser les fichiers écrits.
