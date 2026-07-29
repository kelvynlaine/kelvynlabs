#!/usr/bin/env bash
# =============================================================================
# Kelvynlabs — sauvegarde de la base et des fichiers
# =============================================================================
#   ./scripts/sauvegarde.sh [dossier-de-destination]
#
# ⚠️ NE COPIEZ JAMAIS le fichier .db avec `cp` pendant que l'application
# tourne. En mode WAL, une partie des écritures récentes vit dans un fichier
# -wal séparé : une copie brute produit une base silencieusement incohérente,
# et vous ne le découvrirez qu'au moment de la restaurer.
#
# `sqlite3 .backup` prend un instantané cohérent, application en marche.
# =============================================================================
set -euo pipefail

DOSSIER_DONNEES="${DOSSIER_DONNEES:-.data}"
BASE="$DOSSIER_DONNEES/kelvynlabs.db"
UPLOADS="$DOSSIER_DONNEES/uploads"
DESTINATION="${1:-sauvegardes}"
HORODATAGE="$(date +%Y-%m-%d_%Hh%M)"
CIBLE="$DESTINATION/$HORODATAGE"

if [ ! -f "$BASE" ]; then
  echo "✗ Base introuvable : $BASE" >&2
  echo "  Définissez DOSSIER_DONNEES si vos données sont ailleurs." >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ sqlite3 n'est pas installé." >&2
  echo "  Debian/Ubuntu : sudo apt install sqlite3" >&2
  echo "  macOS         : déjà présent, sinon brew install sqlite" >&2
  exit 1
fi

mkdir -p "$CIBLE"

echo "→ Instantané de la base…"
sqlite3 "$BASE" ".backup '$CIBLE/kelvynlabs.db'"

# Vérification immédiate : une sauvegarde jamais testée n'est pas une
# sauvegarde. Autant s'en apercevoir maintenant plutôt que le jour du sinistre.
echo "→ Vérification d'intégrité…"
RESULTAT="$(sqlite3 "$CIBLE/kelvynlabs.db" "pragma integrity_check;")"
if [ "$RESULTAT" != "ok" ]; then
  echo "✗ Sauvegarde corrompue : $RESULTAT" >&2
  exit 1
fi

if [ -d "$UPLOADS" ]; then
  echo "→ Copie des fichiers uploadés…"
  tar -czf "$CIBLE/uploads.tar.gz" -C "$DOSSIER_DONNEES" uploads
fi

TAILLE="$(du -sh "$CIBLE" | cut -f1)"
echo "✓ Sauvegarde terminée : $CIBLE ($TAILLE)"

# Rétention : on conserve les 30 dernières. Sans purge, le disque du VPS finit
# par se remplir — panne qui se manifeste toujours au pire moment.
GARDER=30
cd "$DESTINATION"
NOMBRE="$(find . -maxdepth 1 -type d -name '20*' | wc -l | tr -d ' ')"
if [ "$NOMBRE" -gt "$GARDER" ]; then
  find . -maxdepth 1 -type d -name '20*' | sort | head -n "$((NOMBRE - GARDER))" |
    while read -r ancienne; do
      echo "→ Purge de $ancienne"
      rm -rf "$ancienne"
    done
fi

# -----------------------------------------------------------------------------
# Automatisation (sur le VPS) — sauvegarde quotidienne à 3 h du matin :
#
#   crontab -e
#   0 3 * * * cd /opt/kelvynlabs && DOSSIER_DONNEES=/var/lib/docker/volumes/kelvynlabs_donnees/_data ./scripts/sauvegarde.sh /opt/sauvegardes >> /var/log/kelvynlabs-sauvegarde.log 2>&1
#
# ⚠️ Une sauvegarde sur le MÊME disque que les données ne protège que des
# erreurs humaines, pas d'une panne matérielle ni d'une compromission du
# serveur. Recopiez régulièrement /opt/sauvegardes ailleurs (rsync vers une
# autre machine, ou stockage objet).
# -----------------------------------------------------------------------------
