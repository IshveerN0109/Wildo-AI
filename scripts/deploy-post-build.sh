#!/bin/bash
set -e
# Runs inside the deployment's own build environment, so DATABASE_URL here
# is the deployment's (production) database — not the dev workspace's.
# Pushing the schema on every deploy keeps production's tables in sync
# without anyone having to copy a production connection string into the
# dev shell by hand.
pnpm --filter @workspace/db run push-force
pnpm store prune
