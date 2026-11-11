#!/bin/sh
set -e

# Optional schema push if enabled via Dokploy environment variable
if [ "$AUTO_DB_PUSH" = "true" ]; then
  echo "=> AUTO_DB_PUSH=true: Running prisma db push..."
  npx prisma db push --skip-generate || echo "⚠️ Warning: prisma db push encountered an issue, proceeding with server start..."
fi

# Execute the main container command (defaults to node server.js)
exec "$@"

