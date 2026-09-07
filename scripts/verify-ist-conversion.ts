import { formatToIst } from '../src/lib/ist-time';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ Passed: ${msg}`);
}

console.log('--- Testing Global Timezone Standardizer to IST ---');

// 1. UTC 15:03 (which is 11:03 PM in Singapore, 8:33 PM in India)
const utcTimestamp1 = '2026-09-06T15:03:00.000Z';
const formatted1 = formatToIst(utcTimestamp1);
assert(formatted1.includes('08:33 PM IST') && formatted1.includes('06 Sep'), `UTC 15:03 is converted to "06 Sep, 08:33 PM IST" (Got: "${formatted1}")`);

// 2. UTC 16:00 (which is 12:00 AM Singapore, 9:30 PM in India)
const utcTimestamp2 = '2026-09-06T16:00:00.000Z';
const formatted2 = formatToIst(utcTimestamp2);
assert(formatted2.includes('09:30 PM IST') && formatted2.includes('06 Sep'), `UTC 16:00 is converted to "06 Sep, 09:30 PM IST" (Got: "${formatted2}")`);

// 3. Fallback date with time string
const legacyTimeString = '08:33 PM IST';
const formatted3 = formatToIst(legacyTimeString, '2026-09-06');
assert(formatted3 === '06 Sep, 08:33 PM IST', `Legacy time string prepends fallback calendar date: "${formatted3}"`);

console.log('🎉 All Timezone Standardizer Tests Passed!');
