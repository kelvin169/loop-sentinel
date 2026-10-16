import {
  PCA_COMPONENTS,
  SENSOR_KEYS,
  standardize,
  type SensorVector,
} from "./skab";

export type ModelId = "zscore" | "iforest" | "autoencoder";

export const MODEL_LABEL: Record<ModelId, string> = {
  zscore: "Rolling z-score",
  iforest: "Isolation Forest",
  autoencoder: "Autoencoder",
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function harmonic(n: number) {
  return Math.log(n) + 0.5772156649;
}

function cFactor(n: number) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * harmonic(n - 1) - (2 * (n - 1)) / n;
}

type INode =
  | { t: "l"; s: number }
  | { t: "s"; f: number; th: number; L: INode; R: INode };

function buildTree(
  X: number[][],
  height: number,
  maxH: number,
  rnd: () => number,
): INode {
  if (height >= maxH || X.length <= 1) return { t: "l", s: X.length };
  const d = X[0].length;
  const f = Math.floor(rnd() * d);
  let min = Infinity;
  let max = -Infinity;
  for (const row of X) {
    const v = row[f];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return { t: "l", s: X.length };
  const th = min + rnd() * (max - min);
  const left: number[][] = [];
  const right: number[][] = [];
  for (const row of X) (row[f] < th ? left : right).push(row);
  if (left.length === 0 || right.length === 0) return { t: "l", s: X.length };
  return {
    t: "s",
    f,
    th,
    L: buildTree(left, height + 1, maxH, rnd),
    R: buildTree(right, height + 1, maxH, rnd),
  };
}

function pathLength(x: number[], node: INode, h: number): number {
  if (node.t === "l") return h + cFactor(node.s);
  return pathLength(x, x[node.f] < node.th ? node.L : node.R, h + 1);
}

function synthNormal(n: number, rnd: () => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let i = 0; i < SENSOR_KEYS.length; i++) {
      const u = rnd();
      const v = rnd();
      const z = Math.sqrt(-2 * Math.log(Math.max(u, 1e-12))) * Math.cos(2 * Math.PI * v);
      row.push(z * 0.85);
    }
    out.push(row);
  }
  return out;
}

const N_TREES = 40;
const SAMPLE = 96;
const rndTrain = mulberry32(42);
const trainX = synthNormal(SAMPLE, rndTrain);
const maxH = Math.ceil(Math.log2(SAMPLE));
const TREES: INode[] = Array.from({ length: N_TREES }, () =>
  buildTree(trainX, 0, maxH, rndTrain),
);
const C_N = cFactor(SAMPLE);

export function isolationScore(v: SensorVector): number {
  const x = standardize(v);
  let e = 0;
  for (const tree of TREES) e += pathLength(x, tree, 0);
  e /= TREES.length;
  return Math.pow(2, -e / C_N);
}

export function autoencoderScore(v: SensorVector): number {
  const x = standardize(v);
  const z = PCA_COMPONENTS.map((c) => c.reduce((s, w, i) => s + w * x[i], 0));
  const rec = new Array(x.length).fill(0);
  for (let k = 0; k < PCA_COMPONENTS.length; k++) {
    const ck = PCA_COMPONENTS[k];
    for (let i = 0; i < x.length; i++) rec[i] += z[k] * ck[i];
  }
  let mse = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i] - rec[i];
    mse += d * d;
  }
  return mse / x.length;
}

export class RollingZScore {
  private buf: number[][] = [];
  constructor(private window = 60) {}

  score(v: SensorVector): number {
    const x = standardize(v);
    this.buf.push(x);
    if (this.buf.length > this.window) this.buf.shift();
    const n = this.buf.length;
    const d = x.length;
    const mu = new Array(d).fill(0);
    for (const row of this.buf) for (let i = 0; i < d; i++) mu[i] += row[i];
    for (let i = 0; i < d; i++) mu[i] /= n;
    let maxZ = 0;
    if (n < 4) return 0;
    const sd = new Array(d).fill(0);
    for (const row of this.buf)
      for (let i = 0; i < d; i++) {
        const e = row[i] - mu[i];
        sd[i] += e * e;
      }
    for (let i = 0; i < d; i++) {
      const s = Math.sqrt(sd[i] / n) + 1e-8;
      const z = Math.abs((x[i] - mu[i]) / s);
      if (z > maxZ) maxZ = z;
    }
    return maxZ;
  }

  reset() {
    this.buf = [];
  }
}

export function scoreModel(
  model: ModelId,
  v: SensorVector,
  z: RollingZScore,
): number {
  if (model === "iforest") return isolationScore(v);
  if (model === "autoencoder") return autoencoderScore(v);
  return z.score(v);
}

export function scoreAll(v: SensorVector, z: RollingZScore) {
  return {
    zscore: z.score(v),
    iforest: isolationScore(v),
    autoencoder: autoencoderScore(v),
  };
}

/** Default high-precision quantiles of each score on healthy data. */
export const HEALTHY_QUANTILE = {
  zscore: 2.6,
  iforest: 0.62,
  autoencoder: 0.55,
};
