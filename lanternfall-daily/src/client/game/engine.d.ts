import type { Night, RunReport } from '../../shared/night';

export type EngineSettings = {
  sound: boolean;
  shake: boolean;
};

export type RunEnd = {
  report: RunReport;
  survived: boolean; // reached dawn
  wave: number; // wave the run ended in (1-6)
};

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  settings: EngineSettings;
  firstTime: boolean;
  onEnd: (end: RunEnd) => void;
};

export type SimResult = {
  mode: string;
  wave?: number;
  t?: number;
  lvl?: number;
  hp?: number;
  kills?: number;
  boss?: number | null;
  dawn?: number;
  victory?: boolean;
  bossKilled?: boolean;
};

export type Engine = {
  start(night: Night): void;
  readonly mode: string;
  initAudio(): void;
  click(): void;
  sim(steps: number, opts?: { god?: boolean; move?: boolean; dash?: boolean; pickRandom?: boolean }): SimResult;
  destroy(): void;
};

export declare function createEngine(opts: EngineOptions): Engine;
export declare function svgIcon(id: string, color: string): string;
export declare const WEAPONS: Record<string, { name: string; color: string; evo: string; evoName: string; lv: string[]; evoDesc: string }>;
export declare const PASSIVES: Record<string, { name: string; color: string; desc: string }>;
