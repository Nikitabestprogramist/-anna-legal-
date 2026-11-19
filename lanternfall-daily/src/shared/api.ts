import type { ModifierId, Night, RunReport, ScoreBreakdown } from './night';

export type LeaderRow = {
  rank: number;
  username: string;
  score: number;
};

export type MyStatus = {
  played: boolean; // played tonight's ranked run
  score: number | null;
  rank: number | null; // 1-based
  streak: number; // nights in a row
  nights: number; // total nights played
  bestScore: number;
  shared: boolean; // already posted a result comment for this night
};

export type VoteState = {
  options: ModifierId[];
  counts: Record<string, number>;
  mine: ModifierId | null;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string | null;
  night: Night;
  isTonight: boolean; // false when this post shows a past night
  tonightUrl: string | null; // link to the current night's post
  players: number;
  kills: number;
  bossKills: number;
  top: LeaderRow[];
  me: MyStatus;
  vote: VoteState;
};

export type ScoreRequest = {
  report: RunReport;
};

export type ScoreResponse = {
  type: 'score';
  ranked: boolean; // false for practice runs and past nights
  breakdown: ScoreBreakdown;
  rank: number | null;
  players: number;
  top: LeaderRow[];
  me: MyStatus;
  newBest: boolean;
};

export type VoteRequest = {
  option: ModifierId;
};

export type VoteResponse = {
  type: 'vote';
  vote: VoteState;
};

export type ShareResponse = {
  type: 'share';
  ok: boolean;
  message: string;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
