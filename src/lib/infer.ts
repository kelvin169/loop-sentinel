import {
  HEALTHY_QUANTILE,
  isolationScore,
  autoencoderScore,
  type ModelId,
} from "./models";
import { SENSOR_KEYS, SENSOR_META, type SensorVector } from "./skab";

export type InferRequest = {
  sensors: SensorVector;
  model?: ModelId;
  threshold?: number;
};

export type InferResponse = {
  model: ModelId;
  score: number;
  threshold: number;
  anomaly: boolean;
  scores: { zscore?: number; iforest: number; autoencoder: number };
  tags: {
    name: string;
    type: "REAL" | "BOOL" | "DINT";
    value: string | number | boolean;
  }[];
  topic: string;
};

const MODEL_DINT: Record<ModelId, number> = {
  zscore: 0,
  iforest: 1,
  autoencoder: 2,
};

export function runInference(req: InferRequest): InferResponse {
  const sensors = {} as SensorVector;
  for (const k of SENSOR_KEYS) sensors[k] = req.sensors[k];
  const model: ModelId = req.model === "iforest" ? "iforest" : "autoencoder";
  const iforest = isolationScore(sensors);
  const autoencoder = autoencoderScore(sensors);
  const score = model === "iforest" ? iforest : autoencoder;
  const threshold = req.threshold ?? HEALTHY_QUANTILE[model];
  const anomaly = score >= threshold;

  const tags: InferResponse["tags"] = SENSOR_KEYS.map((k) => ({
    name: SENSOR_META[k].tag,
    type: "REAL" as const,
    value: Number(sensors[k].toFixed(5)),
  }));
  tags.push(
    { name: "AD_01.Score", type: "REAL", value: Number(score.toFixed(5)) },
    { name: "AD_01.Threshold", type: "REAL", value: Number(threshold.toFixed(5)) },
    { name: "AD_01.Anomaly", type: "BOOL", value: anomaly },
    { name: "AD_01.Model", type: "DINT", value: MODEL_DINT[model] },
  );

  return {
    model,
    score,
    threshold,
    anomaly,
    scores: { iforest, autoencoder },
    tags,
    topic: "plant/pump01/ad",
  };
}
