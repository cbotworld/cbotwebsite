const fs = require('fs');
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
for (const profile of Object.values(eas.build)) {
  if (profile.env && Object.prototype.hasOwnProperty.call(profile.env, 'EXPO_PUBLIC_APP_API_KEY')) {
    profile.env.EXPO_PUBLIC_APP_API_KEY = '';
  }
}
fs.writeFileSync('eas.json', JSON.stringify(eas, null, 2) + '\n');
console.log('eas.json env key cleared');
