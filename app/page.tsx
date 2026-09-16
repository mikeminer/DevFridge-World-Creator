import { FLOW_STEPS, TAGLINE, COMMITMENT_COPY } from "@/lib/copy";
import { DISCORD_CREATOR_CHANNEL_ID, DISCORD_REVIEW_GUILD_ID, PASTA_MINT, WORLD_URL, DOCS_WORLD_URL, CONNECT_URL } from "@/lib/config";

export default function HomePage() {
  return (
    <main className="wrap">
      <p className="kicker">DevFridge World Creator</p>
      <h1>{TAGLINE}</h1>
      <p className="muted">
        External meme communities use Discord to generate a World-ready 3D asset, pass review, and
        commit $PASTA so the character can become eligible in a later season of{" "}
        <a href={WORLD_URL}>world.devfridge.cool</a>. The current World pre-launch cast is the official
        kitchen. This pipeline is how new communities apply for the next seasons.
      </p>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="steps">
          {FLOW_STEPS.map((s) => (
            <div className="step" key={s.key}>
              <b>{s.title}</b>
              <span>{s.body}</span>
            </div>
          ))}
        </div>
        <p className="muted">{COMMITMENT_COPY}</p>
        <p className="muted">
          $PASTA mint <code>{PASTA_MINT}</code> · ticker ≠ identity. A commitment does not grant
          third-party IP rights and does not protect market cap.
        </p>
        <div className="row">
          <a className="btn" href={`https://discord.com/channels/${DISCORD_REVIEW_GUILD_ID}/${DISCORD_CREATOR_CHANNEL_ID}`}>
            Open the Discord channel
          </a>
          <a className="btn" href={DOCS_WORLD_URL}>
            World docs
          </a>
          <a className="btn" href="/v1/world/manifest.json">
            Active manifest
          </a>
          <a className="btn sauce" href={CONNECT_URL}>
            Official contacts
          </a>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 24 }}>
        In Discord: <code>/world create</code> · <code>/world status</code> · <code>/world preview</code> ·{" "}
        <code>/world my-assets</code> · <code>/world optout</code> · <code>/world report</code>
      </p>
    </main>
  );
}
