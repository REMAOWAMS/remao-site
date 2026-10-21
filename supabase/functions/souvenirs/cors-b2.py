"""Pose sur le bucket la règle CORS qui autorise remao.org à y déposer des fichiers.

Le réglage CORS de l'interface Backblaze n'autorise que la lecture (GET/HEAD) : les
envois (PUT) depuis le navigateur sont refusés en 403. Il faut donc une règle sur mesure,
qui ne se pose que par l'API. À lancer une seule fois :
    python cors-b2.py
La clé est demandée au clavier et n'est écrite nulle part. Elle doit pouvoir modifier les
buckets : la « Master Application Key », ou une clé créée avec « All » buckets en Read and Write.
"""
import base64, getpass, json, urllib.request, urllib.error

BUCKET = "remao-souvenirs-conakry-2026"
REGLES = [{
    "corsRuleName": "envoisRemao",
    "allowedOrigins": ["https://remao.org", "https://www.remao.org"],
    "allowedOperations": ["s3_put", "s3_get", "s3_head"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600,
}]


def appel(url, donnees=None, entetes=None):
    req = urllib.request.Request(url, data=json.dumps(donnees).encode() if donnees else None, headers=entetes or {})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Refusé par Backblaze ({e.code}) : {e.read().decode()[:300]}")


key_id = input("keyID : ").strip()
key = getpass.getpass("applicationKey (rien ne s'affiche, c'est normal) : ").strip()
auth = appel("https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
             entetes={"Authorization": "Basic " + base64.b64encode(f"{key_id}:{key}".encode()).decode()})
api = auth["apiInfo"]["storageApi"]
h = {"Authorization": auth["authorizationToken"]}
compte = auth["accountId"]

buckets = appel(api["apiUrl"] + "/b2api/v3/b2_list_buckets", {"accountId": compte, "bucketName": BUCKET}, h)["buckets"]
if not buckets:
    raise SystemExit("Bucket introuvable avec cette clé.")
r = appel(api["apiUrl"] + "/b2api/v3/b2_update_bucket",
          {"accountId": compte, "bucketId": buckets[0]["bucketId"], "corsRules": REGLES,
           # n'en garder qu'une version : un fichier supprimé libère vraiment sa place
           "lifecycleRules": [{"fileNamePrefix": "", "daysFromHidingToDeleting": 1, "daysFromUploadingToHiding": None}]}, h)
print("Règle posée :", [c["corsRuleName"] for c in r["corsRules"]], "- effective d'ici 10 minutes environ.")
