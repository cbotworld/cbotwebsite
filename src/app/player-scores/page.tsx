import { getPublicScoreboard } from '@/lib/actions/playerScoreActions';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { PUBLIC_PLAYER_SCORES_PATH } from '@/lib/website-cms';
import PlayerScoresClient from './PlayerScoresClient';

export const dynamic = 'force-dynamic';

export default async function PlayerScoresPage() {
  const [cms, board] = await Promise.all([getWebsiteCmsContent(), getPublicScoreboard()]);
  return (
    <PlayerScoresClient
      editionTitle={board.edition?.title || cms.pages.playerScores.title}
      days={board.days}
      teams={board.teams}
      scores={board.scores}
    />
  );
}

export const metadata = {
  title: 'Player Scores',
  alternates: { canonical: PUBLIC_PLAYER_SCORES_PATH },
};
