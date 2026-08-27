const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
function get(k) {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

const key = get('EXPO_PUBLIC_APP_API_KEY');
if (!key) {
  console.error('missing EXPO_PUBLIC_APP_API_KEY in .env');
  process.exit(1);
}

const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
for (const profile of Object.values(eas.build)) {
  if (profile.env) profile.env.EXPO_PUBLIC_APP_API_KEY = key;
}
fs.writeFileSync('eas.json', JSON.stringify(eas, null, 2) + '\n');
console.log('eas.json env key set, length', key.length);
