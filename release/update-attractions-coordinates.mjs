import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const defaultJsonPath = path.resolve('public/attractions.json');

function usage() {
  console.log(`Usage:
  node public/update-attractions-coordinates.mjs '[ [id,x,y], ... ]'
  cat vectors.json | node public/update-attractions-coordinates.mjs

Optional:
  --file <path>    Read vectors from a JSON file instead of stdin/argv
  --dry-run        Print changes without writing the file
`);
}

function parseVectors(text) {
  const value = JSON.parse(text);
  if (!Array.isArray(value)) {
    throw new Error('Vector input must be a JSON array of [id, x, y] entries.');
  }

  return value.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 3) {
      throw new Error(`Invalid vector at index ${index}: expected [id, x, y].`);
    }

    const [id, x, y] = entry;
    if (!Number.isInteger(id)) {
      throw new Error(`Invalid id at index ${index}: expected an integer.`);
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new Error(`Invalid coordinates at index ${index}: expected numeric x/y.`);
    }

    return [id, x, y];
  });
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input.trim()));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const fileIndex = args.indexOf('--file');
  const inputFile = fileIndex >= 0 ? args[fileIndex + 1] : null;

  if (fileIndex >= 0 && !inputFile) {
    throw new Error('Missing value after --file.');
  }

  let rawVectors = '';
  if (inputFile) {
    rawVectors = fs.readFileSync(path.resolve(inputFile), 'utf8').trim();
  } else if (args.length > 0) {
    const filteredArgs = args.filter((arg, index) => {
      if (arg === '--dry-run') return false;
      if (arg === '--file') return false;
      if (fileIndex >= 0 && index === fileIndex + 1) return false;
      return true;
    });
    rawVectors = filteredArgs.join(' ').trim();
  }

  if (!rawVectors) {
    rawVectors = await readStdin();
  }

  if (!rawVectors) {
    usage();
    process.exitCode = 1;
    return;
  }

  const vectors = parseVectors(rawVectors);
  const jsonPath = defaultJsonPath;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  if (!Array.isArray(data.attractions)) {
    throw new Error('public/attractions.json does not contain an attractions array.');
  }

  const byId = new Map(data.attractions.map((item) => [item.id, item]));
  const missingIds = [];
  const updatedIds = [];

  for (const [id, x, y] of vectors) {
    const attraction = byId.get(id);
    if (!attraction) {
      missingIds.push(id);
      continue;
    }

    attraction.x = x;
    attraction.y = y;
    updatedIds.push(id);
  }

  const output = JSON.stringify(data, null, 2) + '\n';

  if (dryRun) {
    console.log(output);
  } else {
    fs.writeFileSync(jsonPath, output);
  }

  console.log(`Updated ${updatedIds.length} attraction(s).`);
  if (missingIds.length > 0) {
    console.log(`Missing ids: ${missingIds.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});