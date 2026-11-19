# Lanternfall

A daily survival roguelite that lives inside a Reddit post. Every day the subreddit gets a new **night**: the same seed, the same twist and the same boss for everyone. You get one ranked run per night, about four minutes long. Survive five waves of shades, build a combination of weapons and charms, then defeat the night's boss before dawn. Your score goes on that night's leaderboard, and at the end you vote on tomorrow's twist.

Built with [Devvit Web](https://developers.reddit.com/) for Reddit's Game of the Day hackathon.

## How a night works

1. Shortly after midnight UTC a scheduled task posts the new night (`Lanternfall · Night 12: Blood Moon`).
2. The post's feed card shows tonight's twist, how many players have lit their lantern, how many shades the community has banished, and the top three scores.
3. **Light the lantern** opens the game. Your first run of the night is ranked; later runs are practice and show where they would have placed.
4. The results screen shows your score breakdown and rank, tonight's leaderboard, a vote for tomorrow's twist, and a button to post your result as a comment.

## Game design

| Mechanic | What it does |
| --- | --- |
| Auto-firing weapons | You only steer and dash. Five weapons: Lantern Bolt, Moth Ring, Flare Pulse, Arc Spark, Ember Comet. |
| Level-up cards | Sparks from kills level you up; pick 1 of 3 cards. Rerolls and skips give control. |
| Build limits | 3 weapon slots and 4 charm slots, so every pick is a trade-off. |
| Evolutions | A level 5 weapon plus its matching charm evolves into a much stronger form (Sunlance, Moth Storm, Solar Flare, Storm Lantern, Meteor Rain). Cards show which charm each weapon needs. |
| Readable enemies | Shades chase, wisps weave, brutes tank, spitters glow before they shoot, bloaters fuse and burst (and hurt other enemies). |
| Wave events | An encirclement with one gap in wave 4; golden elites that drop chests with a free upgrade. |
| Boss before dawn | The Warden (telegraphed charges, summons) or the Hollow King (ring volleys, spirals, charges, a second phase). Kill it before the 90-second dawn timer to score a speed bonus. |
| Streaks | Kill quickly without being hit to build a streak. Getting hit resets it. |
| Grazes | Letting an enemy bullet pass very close without hitting you pays out a spark and keeps your streak alive, rewarding brave movement. |
| Daily twists | 12 modifiers such as Blood Moon, The Swarm, Glass Lantern, Thick Fog and Heavy Boots. |
| Fairness | Spawns, card offers and drops come from the night's seed, so everyone faces the same night. The server re-computes the score and rejects impossible runs. |

Game feel: hit-stop on big hits, trauma-based screen shake (can be turned off), a camera punch-in on elite kills, evolutions and the boss kill, white hit flashes with a brief swell, knockback, damage numbers, squash and stretch, slow-motion before level-ups, dash afterimages, a dash input buffer (a press just before the dash recharges still counts), rising pitch when collecting sparks, synthesized sound effects, phone vibration on hits, a low-health heartbeat and off-screen markers for bosses, elites and chests. Gamepads work too (stick to move, A to dash, A/B/X/Y to pick cards). It respects `prefers-reduced-motion`.

## Community features

- One shared night per day with an automatic daily post.
- Nightly leaderboard, personal rank, best score and a streak of nights played.
- Community totals on the feed card (lanterns lit, shades banished).
- Players vote on tomorrow's twist; the winner becomes the next night's modifier.
- One-tap result comment posted as the player (with their permission), and a share sheet.
- Old night posts keep their final leaderboard and link to tonight's post.

## Project layout

```
devvit.json              Reddit app config: entrypoints, permissions, menu, install trigger, daily scheduler
src/shared/night.ts      Nights, modifiers, vote options, scoring and plausibility checks (+ tests)
src/shared/api.ts        API types shared by client and server
src/server/              Hono routes and Redis storage
src/client/splash.*      Feed card (inline view)
src/client/game.*        Game page (expanded view)
src/client/game/engine.js  Canvas game engine
assets/icon.png          App icon for the listing
```

## Run it

You need Node 22 or newer and a Reddit account.

```bash
npm install
npm run login        # connects the Devvit CLI to your Reddit account
npm run dev          # builds and starts a playtest on a test subreddit
```

`npm run dev` prints a link to your playtest subreddit. Installing the app creates tonight's post automatically. Moderators can also use the subreddit menu item **Lanternfall: post tonight's night**.

Checks: `npm run test:types`, `npm run lint`, `npm run test:unit`, `npm run build`.

## Publish

```bash
npm run deploy       # type-check, lint and upload a new version
npm run launch       # deploy and submit for review so others can install it
```

The app name in `devvit.json` (`lanternfall-daily`) must be unique on Reddit. If the upload says it is taken, change `name` in `devvit.json` and `package.json`.

## Play-testing so far

Automated only; no human has played it yet. A scripted bot played both this version and the earlier standalone prototype under the same conditions (five runs each):

| Measure | Earlier prototype | This version |
| --- | --- | --- |
| Dash presses made up to 0.2 s before the dash recharged that still produced a dash | 0 of 32 | 20 of 20 |
| Dash presses that produced a dash (pressing every 0.95 s) | 52% | 62% |
| Kills in the first 3 minutes (average) | 238 | 259 |
| Level-ups in the first 3 minutes (average) | 7.0 | 7.2 |

Over eight different nights the bot reached dawn every time and defeated the boss in four. Human play-testing on desktop and the Reddit app is the next step.
