#!/bin/zsh
set -e

npm run build

echo -n "Enter release name (will be saved as pen-map-<name>.zip): "
read name

zip_name="pen-map-${name}.zip"

cd dist
zip -r "../${zip_name}" .
cd ..

created_at=$(TZ=UTC date '+%Y-%m-%dT%H:%M:%SZ')
echo "${zip_name}  ${created_at}" >> versions.txt

echo "Created: ${zip_name}"
echo "Logged:  ${zip_name}  ${created_at} → versions.txt"
