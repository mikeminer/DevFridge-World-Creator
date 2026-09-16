import { notFound } from "next/navigation";
import { PreviewViewer } from "@/components/PreviewViewer";
import { COMMITMENT_COPY } from "@/lib/copy";
import { fileUrl, verifyPreviewToken } from "@/lib/ids";
import { findSub, latestVersion } from "@/lib/sdk";
import { readStore } from "@/lib/store";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const data = await readStore((db) => {
    try {
      const sub = findSub(db.submissions, params.id);
      return { sub, version: latestVersion(db.assetVersions, sub.id) || null };
    } catch {
      return null;
    }
  });
  if (!data) notFound();
  if (data.sub.status !== "ACTIVE" && !verifyPreviewToken(searchParams.t || "", data.sub.id)) {
    return (
      <main className="wrap">
        <div className="card">
          <h1>Preview locked</h1>
          <p className="muted">This unpublished asset needs a signed Discord preview link.</p>
        </div>
      </main>
    );
  }
  const glbUrl = data.version ? fileUrl(data.version.finalGlbKey) : "";
  return (
    <main className="wrap">
      <p className="kicker">{data.sub.publicId}</p>
      <h1>{data.sub.name}</h1>
      <p className="muted">
        {data.sub.projectName} · {data.sub.status}
        {data.version ? ` · v${data.version.version} · ${(data.version.fileBytes / 1024).toFixed(1)} KB` : ""}
      </p>
      <div className="card" style={{ marginTop: 18 }}>
        {glbUrl ? <PreviewViewer glbUrl={glbUrl} /> : <p>Generation is not ready yet.</p>}
        <p className="muted">{COMMITMENT_COPY}</p>
      </div>
    </main>
  );
}
