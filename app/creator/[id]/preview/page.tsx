import { notFound } from "next/navigation";
import { PreviewViewer } from "@/components/PreviewViewer";
import { COMMITMENT_COPY } from "@/lib/copy";
import { fileUrl, verifyPreviewToken } from "@/lib/ids";
import { loadPreviewRecord } from "@/lib/preview/catalog";
import { findSub, latestVersion } from "@/lib/sdk";
import { readStore } from "@/lib/store";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t || "";
  const catalog = await loadPreviewRecord(params.id);
  let payload: {
    id: string;
    publicId: string;
    name: string;
    projectName: string;
    status: string;
    glbUrl: string;
    fileBytes: number;
  } | null = catalog
    ? {
        id: catalog.id,
        publicId: catalog.publicId,
        name: catalog.name,
        projectName: catalog.projectName,
        status: catalog.status,
        glbUrl: catalog.glbUrl,
        fileBytes: catalog.fileBytes,
      }
    : null;

  if (!payload) {
    const data = await readStore((db) => {
      try {
        const sub = findSub(db.submissions, params.id);
        return { sub, version: latestVersion(db.assetVersions, sub.id) || null };
      } catch {
        return null;
      }
    });
    if (!data) notFound();
    payload = {
      id: data.sub.id,
      publicId: data.sub.publicId,
      name: data.sub.name,
      projectName: data.sub.projectName,
      status: data.sub.status,
      glbUrl: data.version
        ? data.version.finalGlbKey.startsWith("http")
          ? data.version.finalGlbKey
          : fileUrl(data.version.finalGlbKey)
        : "",
      fileBytes: data.version?.fileBytes || 0,
    };
  }

  if (payload.status !== "ACTIVE" && !verifyPreviewToken(token, payload.id)) {
    return (
      <main className="wrap">
        <div className="card">
          <h1>Preview locked</h1>
          <p className="muted">This unpublished asset needs a signed Discord preview link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="preview-page">
      <header className="preview-head">
        <p className="kicker">DevFridge World Creator</p>
        <h1>{payload.name}</h1>
        <p className="muted">
          {payload.publicId} · generated from the Discord pipeline · {payload.status}
        </p>
      </header>
      {payload.glbUrl ? (
        <PreviewViewer
          glbUrl={payload.glbUrl}
          name={payload.name}
          publicId={payload.publicId}
          projectName={payload.projectName}
          fileBytes={payload.fileBytes}
        />
      ) : (
        <p className="wrap muted">Generation is not ready yet.</p>
      )}
      <p className="wrap muted">{COMMITMENT_COPY}</p>
    </main>
  );
}
