# DevFridge World Creator

Discord-native pipeline so an **external meme community** can submit a playable character into the standard flow for **next seasons** of [DevFridge World](https://world.devfridge.cool).

Current World (see [docs.devfridge.cool/world](https://docs.devfridge.cool/world)) is the official ten-character kitchen, gated by 500,000 actively timelocked character tokens. World Creator does **not** mint you into that cast. It is the onboarding rail for later seasons:

```text
Discord /world create
  → source image(s) + rights declaration
  → AI image-to-3D (GLB)
  → creator preview + confirm
  → DevFridge review
  → $PASTA commitment (Fridge time-lock)
  → eligibility while the verified lock window is active
  → community adoption
```

Architecture spec: [`DEVFRIDGE_WORLD_CREATOR_SDK_DISCORD.md`](./DEVFRIDGE_WORLD_CREATOR_SDK_DISCORD.md)

## Discord target

Installed against the DevFridge guild / creator channel:

https://discord.com/channels/1190606959246835764/1549687923350175784

| | |
|---|---|
| Guild | `1190606959246835764` |
| Channel | `1549687923350175784` |

### Creator commands

`/world create` · `/world status` · `/world preview` · `/world my-assets` · `/world optout` · `/world report` · `/world help`

### Admin commands

`/world-admin queue` · `review` · `approve` · `reject` · `quote` · `suspend` · `restore`

`/world create` only works in the creator channel.

## What a commitment is (and is not)

Commit $PASTA to activate the character for a defined period. The principal stays under [DevFridge time-lock](https://docs.devfridge.cool/fridge) rules. When the lock matures, redemption follows the protocol, including the current **2% $PASTA burn**.

A commitment:

- is **not** an IP license
- is **not** a conventional listing fee paid to DevFridge
- does **not** protect market cap
- does **not** unlock early if the creator opts the asset out of the game

$PASTA mint: `39kMeX4HVRW9qbbiHSPbRQ9xeXUF18GrNP6gL61Ppump` · ticker ≠ identity.

## Run locally

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

App: http://localhost:3020  
Health: http://localhost:3020/api/health  
Manifest: http://localhost:3020/v1/world/manifest.json

The 3D previewer (`/creator/[id]/preview`) is meant to run on **Vercel**. Discord "Open 3D Preview" uses `CREATOR_BASE_URL`. After a GLB is generated, the bot publishes it to that origin (`POST /api/v1/preview/publish`) so the viewer does not depend on the local disk.

Without `MESHY_API_KEY`, generation uses a placeholder GLB so the Discord → preview → review → quote loop can be tested.

## Put the bot in Discord

Slash commands do **not** appear until a Discord Application exists, the bot is invited to the guild, and `/world` is registered. Code in this repo is not enough by itself.

### Fastest path (gateway, no public URL)

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. Bot → Add Bot → copy token. General Information → copy Application ID and Public Key.
3. **Leave Interactions Endpoint URL empty.**
4. Invite (send messages + embeds + attach files + view channel):

```
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&permissions=52224&scope=bot%20applications.commands&guild_id=1190606959246835764
```

5. Local `.env`:

```
DISCORD_APPLICATION_ID=...
DISCORD_PUBLIC_KEY=...
DISCORD_BOT_TOKEN=...
DISCORD_REVIEW_GUILD_ID=1190606959246835764
DISCORD_CREATOR_CHANNEL_ID=1549687923350175784
```

6. Apri la dashboard Tkinter, incolla ID / Public Key / Bot Token, **Salva**, poi **Avvia bot**:

```bash
npm run discord:dashboard
```

O doppio click su `apri-dashboard.bat`. In alternativa, dopo aver salvato `.env`:

```bash
npm run discord:bot
```

It registers `/world` + `/world-admin` on the guild and answers interactions. Then in https://discord.com/channels/1190606959246835764/1549687923350175784 type `/world help`.

### Production path (Vercel HTTP endpoint)

Deploy, set the same env vars, then set **Interactions Endpoint URL** to `https://YOUR_DOMAIN/api/discord/interactions`. Discord must be able to PING that URL (valid signature → `{ "type": 1 }`). Then:

```bash
npm run discord:register
npm run discord:intro
```

If both a public Interactions Endpoint **and** `discord:bot` are active, Discord may deliver twice — use one or the other.

`DISCORD_ADMIN_USER_IDS` (comma-separated) or Administrator permission is required for `/world-admin`. Set `DISCORD_REVIEW_CHANNEL_ID` if review cards should go to a private channel instead of the creator channel.

## World game integration

The game should **not** duplicate eligibility logic. Fetch the signed-down manifest and lazy-load GLBs:

```ts
const manifest = await fetch("https://YOUR_DOMAIN/v1/world/manifest.json").then((r) => r.json());
for (const asset of manifest.assets) {
  // lazy-load asset.glb_url — never treat a provider URL as production
}
```

Eligibility is computed in `lib/eligibility.ts` (`isWorldAssetEligible`). Discord, the commit page, and the manifest all reuse it.

## Deploy

Vercel is the intended host (`vercel.json` includes generation + reconcile crons).

Required production env: `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `CREATOR_BASE_URL`, `SESSION_SECRET`, `CRON_SECRET`.

For serverless persistence set `DATABASE_URL` (Postgres). Locally the app uses `data/store.json` + `data/storage/`.

Optional: `MESHY_API_KEY` + `THREED_PROVIDER=meshy` for real image-to-3D. The source image URL must be publicly fetchable.

## Claims the product copy will not make

- Not “pay us to list your meme”
- Not “guaranteed exposure”
- Not “the SDK protects $PASTA market cap”
- Not “audited / safe / certified”
- Not “World pays you to play”

Official contacts live only on [connect.devfridge.cool](https://connect.devfridge.cool).
