import { CREATOR_BASE_URL, GENERATION_MAX_ATTEMPTS, MESHY_API_KEY, THREED_PROVIDER } from "../config";
import { notifyGenerationReady } from "../discord/notify";
import { fileUrl, sha256Hex, uuid } from "../ids";
import { downloadUrl, saveBuffer } from "../ingest/images";
import { appendAudit, withStore } from "../store";
import { assertTransition } from "../state";
import { inspectGlb, buildPlaceholderGlb } from "./placeholder";
import { createMeshyTask, getMeshyTask } from "./meshy";

export async function queueGeneration(submissionId: string): Promise<void> {
  await withStore((db) => {
    const sub = db.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new Error("submission not found");
    if (sub.status === "RIGHTS_ATTESTED") assertTransition(sub.status, "GENERATION_QUEUED");
    const attempts = db.generationJobs.filter((j) => j.submissionId === submissionId).length;
    if (attempts >= GENERATION_MAX_ATTEMPTS) {
      throw new Error(`generation limit reached (${GENERATION_MAX_ATTEMPTS})`);
    }
    sub.status = "GENERATION_QUEUED";
    sub.updatedAt = new Date().toISOString();
    db.generationJobs.push({
      id: uuid(),
      submissionId,
      provider: THREED_PROVIDER === "meshy" && MESHY_API_KEY ? "meshy" : "placeholder",
      providerTaskId: null,
      model: THREED_PROVIDER === "meshy" ? "meshy-5" : "placeholder-box",
      status: "QUEUED",
      attempt: attempts + 1,
      costUnits: null,
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    });
    appendAudit(db, {
      actor: `user:${sub.discordUserId}`,
      entityType: "submission",
      entityId: sub.id,
      eventType: "GENERATION_STARTED",
      metadata: { attempt: attempts + 1 },
    });
  });
}

export async function processQueuedJobs(): Promise<number> {
  const jobs = await withStore((db) =>
    db.generationJobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING")
  );
  let n = 0;
  for (const job of jobs) {
    try {
      if (job.status === "QUEUED") {
        await startJob(job.id);
        n++;
      } else {
        await pollJob(job.id);
        n++;
      }
    } catch (err) {
      await failJob(job.id, err instanceof Error ? err.message : String(err));
    }
  }
  return n;
}

async function startJob(jobId: string): Promise<void> {
  const ctx = await withStore((db) => {
    const job = db.generationJobs.find((j) => j.id === jobId);
    const sub = job ? db.submissions.find((s) => s.id === job.submissionId) : null;
    const sources = job ? db.sourceFiles.filter((f) => f.submissionId === job.submissionId) : [];
    if (!job || !sub) throw new Error("job missing");
    job.status = "RUNNING";
    job.startedAt = new Date().toISOString();
    sub.status = "GENERATING";
    sub.updatedAt = new Date().toISOString();
    return { job, sub, sources };
  });

  if (ctx.job.provider === "meshy") {
    const imageUrl = fileUrl(ctx.sources[0].storageKey);
    if (!CREATOR_BASE_URL.startsWith("https://")) {
      throw new Error("Meshy needs a public CREATOR_BASE_URL so it can fetch the source image");
    }
    const taskId = await createMeshyTask(imageUrl, ctx.sub.description);
    await withStore((db) => {
      const job = db.generationJobs.find((j) => j.id === jobId);
      if (job) job.providerTaskId = taskId;
    });
    return;
  }

  const glb = buildPlaceholderGlb();
  await ingestGlb(ctx.job.submissionId, jobId, glb, ctx.sources[0]?.storageKey || "");
}

async function pollJob(jobId: string): Promise<void> {
  const job = await withStore((db) => db.generationJobs.find((j) => j.id === jobId));
  if (!job?.providerTaskId) return;
  const result = await getMeshyTask(job.providerTaskId);
  if (result.status === "PENDING" || result.status === "RUNNING") return;
  if (result.status !== "SUCCEEDED") {
    await failJob(jobId, result.status === "FAILED" ? result.error : "generation failed");
    return;
  }
  const glb = await downloadUrl(result.glbUrl);
  await ingestGlb(job.submissionId, jobId, glb, null);
}

async function ingestGlb(
  submissionId: string,
  jobId: string,
  glb: Buffer,
  thumbnailKey: string | null
): Promise<void> {
  const check = inspectGlb(glb);
  if (!check.valid) throw new Error(check.errors.join("; "));
  const sha = sha256Hex(glb);
  const version = await withStore((db) => {
    return db.assetVersions.filter((v) => v.submissionId === submissionId).length + 1;
  });
  const key = `glb/${submissionId}/v${version}.glb`;
  await saveBuffer(key, glb);
  const thumb = thumbnailKey || `sources/${submissionId}/source_01`;
  await withStore((db) => {
    const sub = db.submissions.find((s) => s.id === submissionId);
    const job = db.generationJobs.find((j) => j.id === jobId);
    if (!sub || !job) return;
    job.status = "SUCCEEDED";
    job.finishedAt = new Date().toISOString();
    db.assetVersions.push({
      id: uuid(),
      submissionId,
      version,
      rawGlbKey: key,
      finalGlbKey: key,
      finalGlbSha256: sha,
      thumbnailKey: thumb,
      triangleCount: 12,
      textureBytes: 0,
      fileBytes: glb.length,
      rigged: false,
      validationStatus: "PASSED",
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    });
    sub.status = "PREVIEW_READY";
    sub.updatedAt = new Date().toISOString();
    appendAudit(db, {
      actor: "worker:generation",
      entityType: "submission",
      entityId: submissionId,
      eventType: "GENERATION_COMPLETED",
      metadata: { sha256: sha, bytes: glb.length, version },
    });
  });
  const published = await withStore((db) => db.submissions.find((s) => s.id === submissionId));
  if (published) {
    const { publishGeneratedPreview } = await import("../preview/push");
    await publishGeneratedPreview({
      id: published.id,
      publicId: published.publicId,
      name: published.name,
      projectName: published.projectName,
      status: published.status,
      version,
      fileBytes: glb.length,
      sha256: sha,
      glb,
    }).catch((err) => console.error("preview publish", err));
  }
  await notifyGenerationReady(submissionId);
}

async function failJob(jobId: string, message: string): Promise<void> {
  await withStore((db) => {
    const job = db.generationJobs.find((j) => j.id === jobId);
    if (!job) return;
    job.status = "FAILED";
    job.finishedAt = new Date().toISOString();
    job.errorMessage = message;
    const sub = db.submissions.find((s) => s.id === job.submissionId);
    if (sub) {
      sub.status = "RIGHTS_ATTESTED";
      sub.updatedAt = new Date().toISOString();
    }
  });
}
