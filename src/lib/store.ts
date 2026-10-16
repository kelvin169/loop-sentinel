import { create } from "zustand";
import {
  HEALTHY_QUANTILE,
  RollingZScore,
  isolationScore,
  autoencoderScore,
  scoreAll,
  type ModelId,
} from "./models";
import { nextSample, type FaultId } from "./plant";
import { MEAN, SENSOR_KEYS, SENSOR_META, type SensorVector } from "./skab";

export type Sample = {
  t: number;
  sensors: SensorVector;
  scores: { zscore: number; iforest: number; autoencoder: number };
  yTrue: 0 | 1;
};

export type Confusion = { tp: number; fp: number; fn: number; tn: number };

export type ApiLog = {
  at: number;
  ms: number;
  ok: boolean;
  body: unknown;
  status: number;
};

type ConsoleState = {
  running: boolean;
  fault: FaultId;
  model: ModelId;
  fnCost: number;
  quantile: number;
  useService: boolean;
  tick: number;
  history: Sample[];
  confusion: Confusion;
  apiLog: ApiLog[];
  lastApi?: InferLive;
  toggleRun: () => void;
  setFault: (f: FaultId) => void;
  setModel: (m: ModelId) => void;
  setFnCost: (n: number) => void;
  setQuantile: (n: number) => void;
  setUseService: (v: boolean) => void;
  step: (rnd: () => number) => Sample;
  pushApi: (log: ApiLog, live?: InferLive) => void;
  reset: () => void;
};

export type InferLive = {
  score: number;
  anomaly: boolean;
  threshold: number;
  model: string;
};

const zRoller = new RollingZScore(60);
const MAX_HIST = 180;
const initialSensors = { ...MEAN } as SensorVector;
const initialSample: Sample = {
  t: 0,
  sensors: initialSensors,
  scores: {
    zscore: 0,
    iforest: isolationScore(initialSensors),
    autoencoder: autoencoderScore(initialSensors),
  },
  yTrue: 0,
};

function emptyConfusion(): Confusion {
  return { tp: 0, fp: 0, fn: 0, tn: 0 };
}

function thresholdFor(model: ModelId, quantile: number) {
  const base = HEALTHY_QUANTILE[model];
  return base * (0.6 + quantile * 0.9);
}

export function currentThreshold(model: ModelId, quantile: number, fnCost: number) {
  const q = thresholdFor(model, quantile);
  const costShift = 1 - Math.min(fnCost, 20) / 40;
  return q * (0.75 + costShift * 0.5);
}

export const useConsole = create<ConsoleState>((set, get) => ({
  running: true,
  fault: "none",
  model: "autoencoder",
  fnCost: 10,
  quantile: 0.7,
  useService: false,
  tick: 0,
  history: [initialSample],
  confusion: emptyConfusion(),
  apiLog: [],
  toggleRun: () => set((s) => ({ running: !s.running })),
  setFault: (fault) => set({ fault }),
  setModel: (model) => set({ model }),
  setFnCost: (fnCost) => set({ fnCost }),
  setQuantile: (quantile) => set({ quantile }),
  setUseService: (useService) => set({ useService }),
  step: (rnd) => {
    const s = get();
    const sensors = nextSample(s.tick, s.fault, rnd);
    const scores = scoreAll(sensors, zRoller);
    const yTrue = s.fault === "none" ? 0 : 1;
    const sample: Sample = { t: s.tick, sensors, scores, yTrue };
    const thr = currentThreshold(s.model, s.quantile, s.fnCost);
    const yPred = scores[s.model] >= thr ? 1 : 0;
    const c = { ...s.confusion };
    if (yTrue && yPred) c.tp += 1;
    else if (!yTrue && yPred) c.fp += 1;
    else if (yTrue && !yPred) c.fn += 1;
    else c.tn += 1;
    const history = [...s.history, sample].slice(-MAX_HIST);
    set({ tick: s.tick + 1, history, confusion: c });
    return sample;
  },
  pushApi: (log, lastApi) =>
    set((s) => ({
      apiLog: [...s.apiLog, log].slice(-12),
      lastApi: lastApi ?? s.lastApi,
    })),
  reset: () => {
    zRoller.reset();
    set({
      tick: 0,
      history: [initialSample],
      confusion: emptyConfusion(),
      apiLog: [],
      lastApi: undefined,
    });
  },
}));

export function tagRows(sensors: SensorVector | undefined, score: number, anomaly: boolean, thr: number, model: ModelId) {
  const rows: { name: string; type: string; value: string }[] = [];
  if (sensors) {
    for (const k of SENSOR_KEYS) {
      rows.push({
        name: SENSOR_META[k].tag,
        type: "REAL",
        value: sensors[k].toFixed(4),
      });
    }
  }
  rows.push(
    { name: "AD_01.Score", type: "REAL", value: score.toFixed(4) },
    { name: "AD_01.Threshold", type: "REAL", value: thr.toFixed(4) },
    { name: "AD_01.Anomaly", type: "BOOL", value: anomaly ? "1" : "0" },
    {
      name: "AD_01.Model",
      type: "DINT",
      value: model === "zscore" ? "0" : model === "iforest" ? "1" : "2",
    },
  );
  return rows;
}
