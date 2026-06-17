#!/bin/zsh
set -e

# Deploy to Azure Blob Storage static website ($web container)
# Requires:
#   - AZURE_STORAGE_CONNECTION_STRING (from Azure Storage account)

usage() {
  echo "Usage: $0 [--dry-run]"
  echo ""
  echo "Requirements:"
  echo "  Set AZURE_STORAGE_CONNECTION_STRING environment variable in .env file"
  echo ""
  echo " Dont forget to install Azure CLI and login:"
  echo "  brew install azure-cli"
  echo "  az login"
  echo ""
  echo "To get storage account name"
  echo "  az storage account list --output table"
  echo ""
  echo "To get connection string:"
  echo "  az storage account show-connection-string --name mirumsharedaistorage --resource-group Mirum-Shared-Resource"
  exit 1
}

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo ">>> DRY RUN - no files will be uploaded"
elif [[ -n "$1" ]]; then
  usage
fi

# Load .env if present
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

# Validate connection string
if [[ -z "$AZURE_STORAGE_CONNECTION_STRING" ]]; then
  echo "Error: AZURE_STORAGE_CONNECTION_STRING not set. Set it in environment or .env file."
  usage
fi

echo "=== Building project ==="
npm run build

echo "=== Deploying dist/ to Azure Blob Storage (\$web) ==="

CONTAINER="\$web"
SRC="dist/"

if $DRY_RUN; then
  echo "[DRY-RUN] Would run:"
  echo "az storage blob sync --connection-string \"***\" --container \"$CONTAINER\" --source \"$SRC\" --delete-destination true"
  echo "=== Dry run complete ==="
  exit 0
fi

az storage blob sync \
  --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
  --container "$CONTAINER" \
  --source "$SRC" \
  --delete-destination true

echo ""
echo "=== Deployment complete ==="

