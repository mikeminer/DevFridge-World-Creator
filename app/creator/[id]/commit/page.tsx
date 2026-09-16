import { notFound } from "next/navigation";
import { CommitClient } from "@/components/CommitClient";
import { verifyPreviewToken } from "@/lib/ids";
import { findSub } from "@/lib/sdk";
import { readStore } from "@/lib/store";

export default async function CommitPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t || "";
  const data = await readStore((db) => {
    try {
      const sub = findSub(db.submissions, params.id);
      const quote = db.commitmentQuotes.filter((q) => q.submissionId === sub.id && q.status === "OPEN").at(-1);
      return { sub, quote };
    } catch {
      return null;
    }
  });
  if (!data) notFound();
  if (!verifyPreviewToken(token, data.sub.id)) {
    return (
      <main className="wrap">
        <div className="card">
          <h1>Commitment link expired</h1>
          <p className="muted">Ask the bot for a fresh `/world status` link.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="wrap">
      <p className="kicker">{data.sub.publicId}</p>
      <h1>Commit $PASTA · {data.sub.name}</h1>
      <div className="card" style={{ marginTop: 18 }}>
        {data.quote ? (
          <CommitClient submissionId={data.sub.id} token={token} quote={data.quote} />
        ) : (
          <p>No open quote. A DevFridge admin issues the quote after review.</p>
        )}
      </div>
    </main>
  );
}
