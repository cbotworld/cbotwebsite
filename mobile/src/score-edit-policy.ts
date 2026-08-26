/** Keep in sync with src/lib/score-edit-policy.ts */

export const SCORE_EDIT_PLAYER_UNTIL = '8:00pm IST';
export const SCORE_EDIT_CAPTAIN_UNTIL = '9:30pm IST';

export const SCORE_EDIT_RULES_TITLE = 'Who can edit scores on that day';

export const SCORE_EDIT_RULES = [
  `Players — until ${SCORE_EDIT_PLAYER_UNTIL}`,
  `Captains — until ${SCORE_EDIT_CAPTAIN_UNTIL}`,
  'Organiser — anytime',
] as const;

export const SCORE_EDIT_PLAYER_HELP =
  `You can enter or change your boards until ${SCORE_EDIT_PLAYER_UNTIL} on this day. After that, your captain can fix them until ${SCORE_EDIT_CAPTAIN_UNTIL}, and the organiser can edit anytime.`;

export const SCORE_EDIT_CAPTAIN_HELP =
  `Players lock at ${SCORE_EDIT_PLAYER_UNTIL}. Captains can still enter or fix teammate boards until ${SCORE_EDIT_CAPTAIN_UNTIL} on this day. After that, only the organiser can edit.`;

export const SCORE_EDIT_ORGANISER_HELP =
  `You can enter or change any player’s boards anytime. Players may self-edit until ${SCORE_EDIT_PLAYER_UNTIL}; captains until ${SCORE_EDIT_CAPTAIN_UNTIL}.`;

export const SCORE_EDIT_PLAYER_CLOSED =
  `Player window closed at ${SCORE_EDIT_PLAYER_UNTIL}. Ask your captain until ${SCORE_EDIT_CAPTAIN_UNTIL}, or the organiser anytime.`;

export const SCORE_EDIT_CAPTAIN_CLOSED =
  `Captain window closed at ${SCORE_EDIT_CAPTAIN_UNTIL}. Ask the organiser — they can edit anytime.`;

export const SCORE_EDIT_NOT_OPEN_YET = 'This day is not open yet (from midnight IST).';
