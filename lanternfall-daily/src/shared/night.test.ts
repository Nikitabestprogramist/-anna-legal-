import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, defaultNight, isPlausible, MODIFIERS, scoreRun, voteOptions, type RunReport } from './night.ts';

const run = (over: Partial<RunReport> = {}): RunReport => ({
  kills: 400,
  seconds: 200,
  bossKilled: true,
  dawnLeft: 30,
  bestStreak: 80,
  level: 18,
  build: ['Sunlance', 'Moth Ring 3'],
  ...over,
});

test('the same day always gives the same night', () => {
  assert.deepEqual(defaultNight('2026-12-01', 5), defaultNight('2026-12-01', 5));
  assert.notEqual(defaultNight('2026-12-01', 5).seed, defaultNight('2026-12-02', 6).seed);
});

test('bosses alternate between nights', () => {
  assert.equal(defaultNight('2026-12-01', 1).boss, 'warden');
  assert.equal(defaultNight('2026-12-02', 2).boss, 'king');
});

test('vote offers three different twists and never repeats tonight', () => {
  for (const m of MODIFIERS) {
    const opts = voteOptions('2026-12-01', m.id);
    assert.equal(opts.length, 3);
    assert.equal(new Set(opts).size, 3);
    assert.ok(!opts.includes(m.id));
  }
});

test('score adds up its parts', () => {
  const s = scoreRun(run());
  assert.equal(s.total, 4000 + 1000 + 2500 + 600 + 400);
  assert.equal(scoreRun(run({ bossKilled: false, dawnLeft: 0 })).boss, 0);
});

test('implausible runs are rejected', () => {
  assert.ok(isPlausible(run()));
  assert.ok(!isPlausible(run({ kills: 100000 })));
  assert.ok(!isPlausible(run({ seconds: 9999 })));
  assert.ok(!isPlausible(run({ bossKilled: false, dawnLeft: 20 })));
  assert.ok(!isPlausible(run({ bestStreak: 500 })));
  assert.ok(!isPlausible(run({ kills: 1.5 })));
  assert.ok(!isPlausible(run({ build: ['x'.repeat(100)] })));
});

test('day arithmetic', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-11-30', '2026-12-08'), 8);
});
