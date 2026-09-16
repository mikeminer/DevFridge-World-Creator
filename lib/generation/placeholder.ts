/**
 * Minimal GLB box used when no Meshy key is configured.
 * Lets the Discord → preview → review pipeline run end-to-end.
 */
function pad4(buf: Buffer): Buffer {
  const n = (4 - (buf.length % 4)) % 4;
  return n ? Buffer.concat([buf, Buffer.alloc(n, 0x20)]) : buf;
}

export function buildPlaceholderGlb(): Buffer {
  const positions = Buffer.alloc(8 * 12);
  const coords = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 1, -0.5],
    [-0.5, 1, -0.5],
    [-0.5, 0, 0.5],
    [0.5, 0, 0.5],
    [0.5, 1, 0.5],
    [-0.5, 1, 0.5],
  ];
  coords.forEach((p, i) => {
    positions.writeFloatLE(p[0], i * 12);
    positions.writeFloatLE(p[1], i * 12 + 4);
    positions.writeFloatLE(p[2], i * 12 + 8);
  });
  const indices = Buffer.from(
    Uint16Array.from([
      0, 1, 2, 0, 2, 3, 1, 5, 6, 1, 6, 2, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7, 3, 2, 6, 3, 6, 7, 4,
      5, 1, 4, 1, 0,
    ]).buffer
  );
  const bin = Buffer.concat([positions, indices]);
  const json = {
    asset: { version: "2.0", generator: "devfridge-world-creator-placeholder" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0, name: "CreatorPlaceholder" }],
    meshes: [
      {
        name: "Box",
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.93, 0.29, 0.21, 1], metallicFactor: 0, roughnessFactor: 0.7 } }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: [-0.5, 0, -0.5],
        max: [0.5, 1, 0.5],
      },
      { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962 },
      { buffer: 0, byteOffset: positions.length, byteLength: indices.length, target: 34963 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  const jsonBuf = pad4(Buffer.from(JSON.stringify(json)));
  const binPadded = pad4(bin);
  const total = 12 + 8 + jsonBuf.length + 8 + binPadded.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonChunk = Buffer.alloc(8);
  jsonChunk.writeUInt32LE(jsonBuf.length, 0);
  jsonChunk.write("JSON", 4, "ascii");
  const binChunk = Buffer.alloc(8);
  binChunk.writeUInt32LE(binPadded.length, 0);
  binChunk.write("BIN\0", 4, "ascii");
  return Buffer.concat([header, jsonChunk, jsonBuf, binChunk, binPadded]);
}

export function inspectGlb(buf: Buffer): {
  valid: boolean;
  fileBytes: number;
  errors: string[];
} {
  const errors: string[] = [];
  if (buf.length < 20) errors.push("GLB too small");
  if (buf.toString("ascii", 0, 4) !== "glTF") errors.push("not a GLB");
  const version = buf.length >= 8 ? buf.readUInt32LE(4) : 0;
  if (version !== 2) errors.push("GLB version must be 2");
  return { valid: errors.length === 0, fileBytes: buf.length, errors };
}
