import { getPublicScoreboard } from '@/lib/actions/playerScoreActions';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { PUBLIC_PLAYER_SCORES_PATH } from '@/lib/website-cms';
import PlayerScoresClient from './PlayerScoresClient';

export const dynamic = 'force-dynamic';

export default async function PlayerScoresPage() {
  const [cms, board] = await Promise.all([getWebsiteCmsContent(), getPublicScoreboard()]);
  const safe = JSON.parse(JSON.stringify(board || {}));
  return (
    <PlayerScoresClient
      editionTitle={safe.edition?.title || cms.pages?.playerScores?.title || 'Player Scores'}
      days={Array.isArray(safe.days) ? safe.days : []}
      teams={Array.isArray(safe.teams) ? safe.teams : []}
      scores={Array.isArray(safe.scores) ? safe.scores : []}
    />
  );
}

export const metadata = {
  title: 'Player Scores',
  alternates: { canonical: PUBLIC_PLAYER_SCORES_PATH },
};
