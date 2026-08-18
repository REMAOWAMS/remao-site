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

### 2. Créer le déclencheur, en SQL

**Pas par l'interface « Database Webhooks ».** Elle ne laisse pas choisir le corps
de la requête : elle envoie toujours son propre format (`type`, `table`, `record`).
Or `/dispatches` exige un corps contenant `event_type`, sans quoi GitHub répond 422
et rien ne part. C'est ce qui a été tenté le 28 juillet 2026, et pourquoi le dépôt
n'a enregistré aucune exécution `repository_dispatch` pendant trois semaines,
pendant lesquelles chaque article partagé sortait sans miniature.

Sur supabase.com, projet `aohfgaxmahcowatzlvyi` :

**a.** Database → **Extensions** → activer `pg_net`.

**b.** SQL Editor, en remplaçant `LE_JETON` par celui de l'étape 1 :

```sql
create or replace function public.declencher_pregeneration()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url := 'https://api.github.com/repos/REMAOWAMS/remao-site/dispatches',
    body := '{"event_type":"contenu-publie"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'remao-site-webhook',
      'Authorization', 'Bearer LE_JETON'
    )
  );
  return null;
end $$;

drop trigger if exists pregeneration_github on public.contenus;

create trigger pregeneration_github
after insert or update or delete on public.contenus
for each statement execute function public.declencher_pregeneration();
```

Le `User-Agent` n'est pas décoratif : l'API GitHub refuse en 403 toute requête qui
n'en porte pas, et cet échec-là ne se voit nulle part.

Le déclencheur est posé **par instruction** et non par ligne : une modification qui
touche plusieurs contenus d'un coup n'envoie qu'un seul appel.

Le jeton vit dans la définition de la fonction, donc visible depuis le tableau de
bord Supabase par qui a accès au projet. Il ne touche aucun fichier du site, c'est
ce qui compte. À l'expiration du jeton, il suffit de rejouer le même bloc.

Mis en service le **18 août 2026**, vérifié le jour même.

### 3. Vérifier

Publier ou modifier n'importe quel contenu depuis `admin.html`, puis ouvrir
l'onglet **Actions** du dépôt. Une exécution « Pregeneration des pages » doit
apparaître dans la minute, avec `repository_dispatch` comme déclencheur.

Sans ouvrir de navigateur, le compteur se lit ainsi :

```
curl -s "https://api.github.com/repos/REMAOWAMS/remao-site/actions/runs?event=repository_dispatch&per_page=1"
```

S'il reste à zéro, la réponse renvoyée par GitHub est consultable côté Supabase dans
la table `net._http_response` : c'est là que se lisent le 403 (User-Agent absent),
le 401 (jeton expiré) et le 422 (corps sans `event_type`).

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
