export type RootStackParamList = {
  Home?: undefined;
  Login: undefined;
  Main: undefined;
  Live: {
    name: string;
    day: string;
    teamName?: string;
    opponentName?: string;
    teamTag?: string;
    opponentTag?: string;
    stage?: string;
    editionTitle?: string;
    timeRange?: string;
    endIso?: string;
    playMode?: 'match' | 'practice' | 'tiebreak';
  };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Combis: undefined;
  Standings: undefined;
  Videos: { player?: string; day?: number; nonce?: number };
  Profile: undefined;
};
