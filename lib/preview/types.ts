export type PreviewRecord = {
  id: string;
  publicId: string;
  name: string;
  projectName: string;
  status: string;
  version: number;
  fileBytes: number;
  sha256: string;
  glbUrl: string;
  thumbnailUrl: string | null;
  publishedAt: string;
};
