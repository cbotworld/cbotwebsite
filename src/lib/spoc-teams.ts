export const TEAM_TYPE_MAIN = 'MAIN';
export const TEAM_TYPE_SPOC = 'SPOC_EXHIBITION';

export function isSpocExhibitionTeam(team: { teamType?: string | null } | null | undefined): boolean {
  return (team?.teamType || TEAM_TYPE_MAIN) === TEAM_TYPE_SPOC;
}

export function isMainTournamentTeam(team: { teamType?: string | null } | null | undefined): boolean {
  return !isSpocExhibitionTeam(team);
}

export function filterMainTeams<T extends { teamType?: string | null }>(teams: T[]): T[] {
  return teams.filter(isMainTournamentTeam);
}

export function filterSpocTeams<T extends { teamType?: string | null }>(teams: T[]): T[] {
  return teams.filter(isSpocExhibitionTeam);
}

export function defaultSpocEventFormats(): string[] {
  return ['SINGLES', 'DOUBLES', 'SINGLES'];
}

export function spocExhibitionStage(stages?: Array<{ kind?: string; spocEventFormats?: string[]; matchPairings?: any[] }>) {
  return stages?.find((s) => s.kind === TEAM_TYPE_SPOC) || null;
}

export function spocEventFormatsFromStage(
  stage?: { spocEventFormats?: string[] } | null,
): string[] {
  if (stage?.spocEventFormats?.length) return stage.spocEventFormats;
  return defaultSpocEventFormats();
}

export type SpocMatchDay = {
  dayNumber: number;
  opponentId?: string;
  opponentName?: string;
  opponentTag?: string;
};

export function spocMatchDaysForTeam(
  teamId: string,
  stages?: Array<{
    kind?: string;
    matchPairings?: Array<{
      dayNumber?: number;
      team1Id?: string;
      team2Id?: string;
      team1Name?: string;
      team2Name?: string;
    }>;
  }>,
  teamsById?: Map<string, { name: string; tag?: string }>,
): SpocMatchDay[] {
  const stage = spocExhibitionStage(stages);
  if (!stage?.matchPairings?.length) return [];

  return stage.matchPairings
    .filter((p) => p.team1Id === teamId || p.team2Id === teamId)
    .map((p) => {
      const isT1 = p.team1Id === teamId;
      const oppId = isT1 ? p.team2Id : p.team1Id;
      const opp = oppId ? teamsById?.get(oppId) : undefined;
      return {
        dayNumber: Number(p.dayNumber) || 0,
        opponentId: oppId,
        opponentName: (isT1 ? p.team2Name : p.team1Name) || opp?.name,
        opponentTag: opp?.tag,
      };
    })
    .filter((d) => d.dayNumber > 0)
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

export function spocTeamMembersFromTeam(team: {
  spocMembers?: Array<{ user?: { id: string; name?: string | null; username?: string | null; image?: string | null; role?: string } | null; userId?: string }>;
} | null | undefined) {
  return (team?.spocMembers || [])
    .map((m) => m.user)
    .filter(Boolean) as Array<{ id: string; name?: string | null; username?: string | null; image?: string | null; role?: string }>;
}
