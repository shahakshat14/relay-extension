const fs = require('node:fs');

const bump = process.argv[2] || 'patch';
const allowed = new Set(['patch', 'minor', 'major']);

if (!allowed.has(bump)) {
  console.error('Usage: npm run bump:version -- patch|minor|major');
  process.exit(1);
}

function nextVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid semver version: ${version}`);
  let [major, minor, patch] = match.slice(1).map(Number);
  if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (manifest.version !== pkg.version) {
  throw new Error(`Version mismatch: manifest ${manifest.version}, package ${pkg.version}`);
}

const oldVersion = manifest.version;
const version = nextVersion(oldVersion);
manifest.version = version;
pkg.version = version;

writeJson('manifest.json', manifest);
writeJson('package.json', pkg);

console.log(`Bumped ${oldVersion} -> ${version}`);
