import { resolveEffectiveTeamCombi, sortRosterByGrade } from '../src/lib/combi-fallback';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ Passed: ${msg}`);
}

console.log('--- Testing Combi Fallback Logic ---');

const mockMembers = [
  { id: 'p6', name: 'Player 6', grade: 'G6', average: 15 },
  { id: 'p2', name: 'Player 2', grade: 'G2', average: 12 },
  { id: 'p1', name: 'Player 1', grade: 'G1', average: 10 },
  { id: 'p4', name: 'Player 4', grade: 'G4', average: 14 },
  { id: 'p3', name: 'Player 3', grade: 'G3', average: 13 },
  { id: 'p5', name: 'Player 5', grade: 'G5', average: 14.5 },
  { id: 'p7', name: 'Player 7', grade: 'G7', average: 16 },
  { id: 'p8', name: 'Player 8', grade: 'G8', average: 18 },
  { id: 'p9', name: 'Player 9', grade: 'G9', average: 20 },
];

const mockFormats = [
  'SINGLES',
  'SINGLES',
  'SINGLES',
  'DOUBLES',
  'DOUBLES',
  'TRIPLES',
];

// 1. Test Grade Sequence Sorting
const sorted = sortRosterByGrade(mockMembers);
assert(sorted[0].id === 'p1', 'First sorted player is G1');
assert(sorted[1].id === 'p2', 'Second sorted player is G2');
assert(sorted[2].id === 'p3', 'Third sorted player is G3');
assert(sorted[8].id === 'p9', 'Ninth sorted player is G9');

// 2. Test Day 1 Fallback Combi Generation
const day1Result = resolveEffectiveTeamCombi({
  team: {
    id: 'team1',
    name: 'Plywood Pioneers',
    savedLineups: null,
    members: mockMembers,
  },
  dayNumber: 1,
  roundFormats: mockFormats,
});

assert(day1Result.isFallback === true, 'Day 1 is flagged as fallback');
assert(day1Result.fallbackType === 'GRADE_SEQUENCE', 'Day 1 fallback type is GRADE_SEQUENCE');
assert(day1Result.rounds.length === 6, 'Day 1 has 6 rounds');
assert(day1Result.rounds[0].players?.[0] === 'Player 1', 'Single 1 has G1 (Player 1)');
assert(day1Result.rounds[1].players?.[0] === 'Player 2', 'Single 2 has G2 (Player 2)');
assert(day1Result.rounds[2].players?.[0] === 'Player 3', 'Single 3 has G3 (Player 3)');
assert(day1Result.rounds[3].players?.[0] === 'Player 4' && day1Result.rounds[3].players?.[1] === 'Player 5', 'Double 1 has G4 & G5');
assert(day1Result.rounds[4].players?.[0] === 'Player 6' && day1Result.rounds[4].players?.[1] === 'Player 7', 'Double 2 has G6 & G7');
assert(day1Result.rounds[5].players?.[0] === 'Player 8' && day1Result.rounds[5].players?.[1] === 'Player 9', 'Triple 1 has G8 & G9');

// 3. Test Day > 1 Carryover from Day 3 to Day 4
const day3Rounds = [
  { name: 'Single 1', players: ['Player 9'], playerIds: ['p9'] },
  { name: 'Single 2', players: ['Player 8'], playerIds: ['p8'] },
];

const teamWithDay3 = {
  id: 'team1',
  name: 'Plywood Pioneers',
  savedLineups: JSON.stringify({
    3: { rounds: day3Rounds, submittedAt: '9:15 PM' },
  }),
  members: mockMembers,
};

const day4Result = resolveEffectiveTeamCombi({
  team: teamWithDay3,
  dayNumber: 4,
  roundFormats: mockFormats,
});

assert(day4Result.isFallback === true, 'Day 4 is fallback');
assert(day4Result.fallbackType === 'PREVIOUS_DAY', 'Day 4 fallback type is PREVIOUS_DAY');
assert(day4Result.sourceDay === 3, 'Day 4 carried over from Day 3');
assert(day4Result.rounds[0].players?.[0] === 'Player 9', 'Day 4 rounds match Day 3');

// 4. Test Day 5 Carryover when Day 4 is also missing (should still carry Day 3)
const day5Result = resolveEffectiveTeamCombi({
  team: teamWithDay3,
  dayNumber: 5,
  roundFormats: mockFormats,
});
assert(day5Result.isFallback === true, 'Day 5 is fallback');
assert(day5Result.fallbackType === 'PREVIOUS_DAY', 'Day 5 fallback type is PREVIOUS_DAY');
assert(day5Result.sourceDay === 3, 'Day 5 carried over from Day 3');

// 5. Test Submitted Combi takes priority
const teamWithDay4 = {
  id: 'team1',
  name: 'Plywood Pioneers',
  savedLineups: JSON.stringify({
    3: { rounds: day3Rounds, submittedAt: '9:15 PM' },
    4: { rounds: [{ name: 'Single 1', players: ['Player 1'], playerIds: ['p1'] }], submittedAt: '9:25 PM' },
  }),
  members: mockMembers,
};

const day4Submitted = resolveEffectiveTeamCombi({
  team: teamWithDay4,
  dayNumber: 4,
  roundFormats: mockFormats,
});
assert(day4Submitted.isFallback === false, 'Day 4 submitted is not fallback');
assert(day4Submitted.fallbackType === 'SUBMITTED', 'Day 4 fallback type is SUBMITTED');
assert(day4Submitted.submittedAt === '9:25 PM', 'Day 4 submittedAt is preserved');

console.log('🎉 All Combi Fallback Verification Tests Passed!');
