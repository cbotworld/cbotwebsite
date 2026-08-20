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
