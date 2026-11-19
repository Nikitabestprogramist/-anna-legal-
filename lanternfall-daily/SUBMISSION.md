# Contest submission notes

Reddit's Game of the Day Hackathon on Devpost. Deadline: **8 December 2026, 6:00 pm PST** (9 December, 02:00 UK time).

Check the official rules page on Devpost before submitting. These notes were written without access to it, so confirm: eligibility, the exact required items (app listing link, demo post, video length), and any rules about AI-assisted code.

## Checklist

- [ ] `npm run deploy` works and the app is uploaded under your Reddit account
- [ ] Install it on a public test subreddit you moderate; confirm the first night post appears
- [ ] Play a full ranked run, a practice run, vote, and post a result comment
- [ ] Check it on the Reddit mobile app and on desktop
- [ ] Leave the subreddit running for a few days so the demo post shows real nights, votes and leaderboards
- [ ] Record a 1 to 3 minute video: feed card, a run with a level-up and an evolution, the boss, results, vote and comment
- [ ] Fill in the Devpost form with the description below, the app link, the demo post link and the video
- [ ] `npm run launch` if the rules ask for a published app

## Draft description

**Lanternfall** is a four-minute survival roguelite that lives in a Reddit post. Every day the subreddit gets a new night: the same seed, the same twist and the same boss for everyone. Your first run counts for the leaderboard, so every day is a fresh, fair competition.

**How it plays.** You steer a lantern keeper and dash through gaps while your weapons fire on their own. Kills drop sparks; each level offers three cards. With three weapon slots and four charm slots, the build is the game: take a weapon to level 5, own its matching charm, and it evolves (Lantern Bolt becomes Sunlance). Five waves introduce one enemy idea at a time, from wisps that weave to bloaters that burst and hurt their own crowd. Then the night's boss appears, and you have 90 seconds to beat it before dawn.

**Why it belongs on Reddit.** Each night is a post with its own leaderboard and comment thread. The feed card shows the twist, how many lanterns are lit and how many shades the community has banished. At the end of a run you vote on tomorrow's twist, so the community decides what the next night looks like, and you can post your result as a comment with one tap.

**Built with.** Devvit Web, TypeScript, Vite, Hono and Redis on Reddit's platform. The game runs on a custom canvas engine with synthesized sound, so the post loads fast with no assets to download. A scheduled task posts each night; seeded randomness keeps spawns and card offers identical for every player; the server recomputes scores and rejects impossible runs.

**What's next.** Weekly community goals, more twists and bosses, and flair for top finishers.
