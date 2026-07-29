# =============================================================================
# Kelvynlabs — image de production
# =============================================================================
# Trois étapes, pour que l'image finale ne contienne ni les sources, ni les
# outils de compilation, ni les dépendances de développement.
# =============================================================================

# --- 1. Dépendances ----------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

# libSQL est livré précompilé : plus besoin de Python ni de chaîne C++ ici.
# Seul `libc6-compat` reste nécessaire, les binaires étant liés à la glibc
# alors qu'Alpine utilise musl.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
# `npm ci` respecte la liste `allowScripts` de package.json : seuls les scripts
# d'installation explicitement autorisés s'exécutent.
RUN npm ci

# --- 2. Build ----------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Aucune variable d'environnement n'est nécessaire au build : la base est un
# fichier local, ouvert seulement à l'exécution.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- 3. Exécution ------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Les données persistantes vivent sur un VOLUME, hors de l'image : un
# redéploiement remplace le code sans jamais toucher aux formations.
ENV DOSSIER_DONNEES=/data

# Exécution sans privilèges : si l'application est compromise, l'attaquant
# n'obtient pas root dans le conteneur.
RUN addgroup --system --gid 1001 kelvynlabs \
 && adduser  --system --uid 1001 kelvynlabs \
 && mkdir -p /data \
 && chown -R kelvynlabs:kelvynlabs /data

COPY --from=builder /app/public ./public

# Sortie « standalone » : le serveur Next et uniquement les dépendances
# réellement atteintes par le code. Quelques dizaines de Mo au lieu du
# node_modules complet.
COPY --from=builder --chown=kelvynlabs:kelvynlabs /app/.next/standalone ./
COPY --from=builder --chown=kelvynlabs:kelvynlabs /app/.next/static ./.next/static

# Les migrations ne font pas partie de la trace du build : sans ces lignes,
# l'application démarrerait sur une base vide et échouerait au premier accès.
COPY --from=builder --chown=kelvynlabs:kelvynlabs /app/drizzle ./drizzle
COPY --from=builder --chown=kelvynlabs:kelvynlabs /app/scripts/migrer.mjs ./scripts/migrer.mjs

# Le script de migration vit hors du graphe de l'application : ses dépendances
# ne sont donc PAS tracées par le build standalone. On les copie explicitement,
# faute de quoi il échouerait sur « Cannot find module ».
COPY --from=deps --chown=kelvynlabs:kelvynlabs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=kelvynlabs:kelvynlabs /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=deps --chown=kelvynlabs:kelvynlabs /app/node_modules/libsql ./node_modules/libsql

USER kelvynlabs
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Les migrations s'appliquent avant le démarrage : un `docker compose up` avec
# une nouvelle image suffit, sans étape manuelle à ne pas oublier.
CMD ["sh", "-c", "node scripts/migrer.mjs && node server.js"]
