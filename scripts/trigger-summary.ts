import { config } from 'dotenv';
config();

import { sendFinalDailyLineupSummaryAction } from '../src/lib/actions/lineupActions';

async function main() {
  console.log('Sending Day 1 Consolidated Summary Email...');
  const result = await sendFinalDailyLineupSummaryAction(1);
  console.log('Result:', result);
}

main().catch(console.error);
