"""Rapatrie sur le PC les vidéos et photos envoyées sur remao.org/souvenirs/.

Usage (PowerShell), la clé Backblaze n'étant jamais écrite dans un fichier :
    $env:B2_KEY_ID = "..."; $env:B2_APP_KEY = "..."
    python telecharger.py                  # télécharge ce qui manque
    python telecharger.py --vider          # puis supprime du bucket ce qui est bien arrivé

Les fichiers sont rangés par pays dans DOSSIER. Un fichier déjà présent à la bonne taille
n'est pas retéléchargé : on peut relancer le script autant de fois qu'on veut.
--vider ne supprime un fichier du bucket qu'après avoir vérifié sa taille sur le disque ;
il libère de la place quand le stockage gratuit (10 Go) approche de la limite.
"""
import os, sys
import boto3
from botocore.config import Config

BUCKET = os.environ.get("B2_BUCKET", "remao-souvenirs-conakry-2026")
ENDPOINT = os.environ.get("B2_ENDPOINT", "s3.us-east-005.backblazeb2.com")
DOSSIER = os.environ.get("SOUVENIRS_DOSSIER", os.path.join(os.path.expanduser("~"), "Videos", "Souvenirs Assises 2026"))

s3 = boto3.client(
    "s3", endpoint_url="https://" + ENDPOINT, region_name=ENDPOINT.split(".")[1],
    aws_access_key_id=os.environ["B2_KEY_ID"], aws_secret_access_key=os.environ["B2_APP_KEY"],
    config=Config(retries={"max_attempts": 10}),
)

vider = "--vider" in sys.argv
objets = [o for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET) for o in page.get("Contents", [])]
total = sum(o["Size"] for o in objets)
print(f"{len(objets)} fichiers dans le bucket, {total / 1e9:.2f} Go -> {DOSSIER}")

nouveaux = 0
for o in objets:
    local = os.path.join(DOSSIER, *o["Key"].split("/"))
    if not (os.path.exists(local) and os.path.getsize(local) == o["Size"]):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        print(f"  {o['Key']} ({o['Size'] / 1e6:.0f} Mo)")
        s3.download_file(BUCKET, o["Key"], local + ".partiel")
        os.replace(local + ".partiel", local)
        nouveaux += 1
    if vider and os.path.getsize(local) == o["Size"]:
        # B2 garde les anciennes versions : un simple delete masquerait le fichier sans
        # libérer la place. On supprime donc chaque version.
        v = s3.list_object_versions(Bucket=BUCKET, Prefix=o["Key"])
        for x in v.get("Versions", []) + v.get("DeleteMarkers", []):
            if x["Key"] == o["Key"]:
                s3.delete_object(Bucket=BUCKET, Key=x["Key"], VersionId=x["VersionId"])

print(f"{nouveaux} nouveaux fichiers." + (" Bucket vidé des fichiers rapatriés." if vider else ""))
