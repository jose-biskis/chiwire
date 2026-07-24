#!/usr/bin/env node
/**
 * Writes simple colored GLB meshes for the Negroni practice station.
 * Run: node apps/valenstonic-academy/scripts/generate-negroni-glbs.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../static/models/negroni");

function align4(n) {
  return (n + 3) & ~3;
}

function padBuffer(buf) {
  const padded = align4(buf.length);
  if (padded === buf.length) return buf;
  const out = Buffer.alloc(padded);
  buf.copy(out);
  return out;
}

function boxMesh(sx, sy, sz) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  // 24 unique vertices (4 per face) for correct normals
  const faces = [
    // +z
    [
      [-hx, -hy, hz],
      [hx, -hy, hz],
      [hx, hy, hz],
      [-hx, hy, hz],
      [0, 0, 1]
    ],
    // -z
    [
      [hx, -hy, -hz],
      [-hx, -hy, -hz],
      [-hx, hy, -hz],
      [hx, hy, -hz],
      [0, 0, -1]
    ],
    // +x
    [
      [hx, -hy, hz],
      [hx, -hy, -hz],
      [hx, hy, -hz],
      [hx, hy, hz],
      [1, 0, 0]
    ],
    // -x
    [
      [-hx, -hy, -hz],
      [-hx, -hy, hz],
      [-hx, hy, hz],
      [-hx, hy, -hz],
      [-1, 0, 0]
    ],
    // +y
    [
      [-hx, hy, hz],
      [hx, hy, hz],
      [hx, hy, -hz],
      [-hx, hy, -hz],
      [0, 1, 0]
    ],
    // -y
    [
      [-hx, -hy, -hz],
      [hx, -hy, -hz],
      [hx, -hy, hz],
      [-hx, -hy, hz],
      [0, -1, 0]
    ]
  ];

  const positions = [];
  const normals = [];
  const indices = [];
  let base = 0;
  for (const face of faces) {
    const n = face[4];
    for (let i = 0; i < 4; i += 1) {
      const v = face[i];
      positions.push(v[0], v[1] + hy, v[2]); // sit on y=0
      normals.push(n[0], n[1], n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return { positions, normals, indices };
}

function cylinderMesh(radius, height, segments = 16) {
  const positions = [];
  const normals = [];
  const indices = [];

  // side
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const nx = Math.cos(theta);
    const nz = Math.sin(theta);
    positions.push(x, 0, z, x, height, z);
    normals.push(nx, 0, nz, nx, 0, nz);
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const sideCount = (segments + 1) * 2;
  // top cap
  const topCenter = sideCount;
  positions.push(0, height, 0);
  normals.push(0, 1, 0);
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(theta) * radius, height, Math.sin(theta) * radius);
    normals.push(0, 1, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    indices.push(topCenter, topCenter + 1 + i, topCenter + 2 + i);
  }

  // bottom cap
  const bottomCenter = positions.length / 3;
  positions.push(0, 0, 0);
  normals.push(0, -1, 0);
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
    normals.push(0, -1, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    indices.push(bottomCenter, bottomCenter + 2 + i, bottomCenter + 1 + i);
  }

  return { positions, normals, indices };
}

function hexToRgba(hex) {
  const cleaned = hex.replace("#", "");
  const value = Number.parseInt(cleaned, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
    1
  ];
}

function writeGlb(filePath, mesh, colorHex) {
  const positions = Float32Array.from(mesh.positions);
  const normals = Float32Array.from(mesh.normals);
  const indices = Uint16Array.from(mesh.indices);
  const color = hexToRgba(colorHex);

  const posByteLength = positions.byteLength;
  const normByteLength = normals.byteLength;
  const indexByteLength = indices.byteLength;

  const bin = Buffer.alloc(align4(posByteLength + normByteLength + indexByteLength));
  Buffer.from(positions.buffer).copy(bin, 0);
  Buffer.from(normals.buffer).copy(bin, posByteLength);
  const indexOffset = posByteLength + normByteLength;
  Buffer.from(indices.buffer).copy(bin, indexOffset);

  const gltf = {
    asset: { version: "2.0", generator: "valenstonic-academy-negroni-glbs" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        name: "solid",
        pbrMetallicRoughness: {
          baseColorFactor: color,
          metallicFactor: 0.15,
          roughnessFactor: 0.55
        }
      }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        max: [
          Math.max(...mesh.positions.filter((_, i) => i % 3 === 0)),
          Math.max(...mesh.positions.filter((_, i) => i % 3 === 1)),
          Math.max(...mesh.positions.filter((_, i) => i % 3 === 2))
        ],
        min: [
          Math.min(...mesh.positions.filter((_, i) => i % 3 === 0)),
          Math.min(...mesh.positions.filter((_, i) => i % 3 === 1)),
          Math.min(...mesh.positions.filter((_, i) => i % 3 === 2))
        ]
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: normals.length / 3,
        type: "VEC3"
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: indices.length,
        type: "SCALAR"
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posByteLength, target: 34962 },
      { buffer: 0, byteOffset: posByteLength, byteLength: normByteLength, target: 34962 },
      {
        buffer: 0,
        byteOffset: indexOffset,
        byteLength: indexByteLength,
        target: 34963
      }
    ],
    buffers: [{ byteLength: bin.length }]
  };

  const json = padBuffer(Buffer.from(JSON.stringify(gltf), "utf8"));
  const binChunk = padBuffer(bin);

  const totalLength = 12 + 8 + json.length + 8 + binChunk.length;
  const out = Buffer.alloc(totalLength);
  out.writeUInt32LE(0x46546c67, 0); // glTF
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);

  let offset = 12;
  out.writeUInt32LE(json.length, offset);
  out.writeUInt32LE(0x4e4f534a, offset + 4); // JSON
  json.copy(out, offset + 8);
  offset += 8 + json.length;

  out.writeUInt32LE(binChunk.length, offset);
  out.writeUInt32LE(0x004e4942, offset + 4); // BIN
  binChunk.copy(out, offset + 8);

  writeFileSync(filePath, out);
}

const models = [
  { slug: "gin-bottle", mesh: cylinderMesh(0.12, 0.5), color: "#93c5fd" },
  { slug: "campari-bottle", mesh: cylinderMesh(0.12, 0.5), color: "#ef4444" },
  { slug: "vermouth-bottle", mesh: cylinderMesh(0.12, 0.5), color: "#7c2d12" },
  { slug: "ice-bucket", mesh: boxMesh(0.28, 0.16, 0.28), color: "#e0f2fe" },
  { slug: "orange-peel", mesh: boxMesh(0.16, 0.04, 0.08), color: "#f97316" },
  { slug: "mixing-glass", mesh: cylinderMesh(0.2, 0.32), color: "#cbd5e1" },
  { slug: "rocks-glass", mesh: cylinderMesh(0.16, 0.2), color: "#e2e8f0" },
  { slug: "barspoon", mesh: boxMesh(0.5, 0.02, 0.03), color: "#cbd5e1" },
  { slug: "jigger", mesh: cylinderMesh(0.07, 0.16), color: "#f59e0b" },
  { slug: "strainer", mesh: cylinderMesh(0.14, 0.05), color: "#94a3b8" },
  { slug: "shaker", mesh: cylinderMesh(0.13, 0.38), color: "#f8fafc" }
];

mkdirSync(outDir, { recursive: true });
for (const model of models) {
  const filePath = path.join(outDir, `${model.slug}.glb`);
  writeGlb(filePath, model.mesh, model.color);
  console.log(`wrote ${filePath}`);
}
