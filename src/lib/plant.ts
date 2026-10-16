import { MEAN, SENSOR_KEYS, STD, type SensorKey, type SensorVector } from "./skab";

export type FaultId = "none" | "valve" | "imbalance" | "motor";

export const FAULT_META: Record<
  FaultId,
  { label: string; blurb: string }
> = {
  none: { label: "Healthy", blurb: "Normal circulation on the testbed." },
  valve: {
    label: "Valve pinch",
    blurb: "Partly closed valve — flow drops, pressure rises.",
  },
  imbalance: {
    label: "Shaft imbalance",
    blurb: "Unbalanced shaft — vibration RMS climbs.",
  },
  motor: {
    label: "Motor stress",
    blurb: "Electrical load swing — current and voltage wander.",
  },
};

function gauss(rnd: () => number) {
  const u = Math.max(rnd(), 1e-12);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function nextSample(
  t: number,
  fault: FaultId,
  rnd: () => number,
): SensorVector {
  const out = {} as SensorVector;
  for (const k of SENSOR_KEYS) {
    const drift = 0.08 * Math.sin(t / 40 + SENSOR_KEYS.indexOf(k));
    out[k] = MEAN[k] + STD[k] * (0.35 * gauss(rnd) + drift);
  }

  if (fault === "valve") {
    out.VolumeFlowRateRMS *= 0.62 + 0.04 * gauss(rnd);
    out.Pressure = MEAN.Pressure + STD.Pressure * (2.8 + 0.4 * gauss(rnd));
    out.Current = MEAN.Current + STD.Current * (1.4 + 0.3 * gauss(rnd));
  } else if (fault === "imbalance") {
    out.Accelerometer1RMS = MEAN.Accelerometer1RMS * (1.9 + 0.15 * gauss(rnd));
    out.Accelerometer2RMS = MEAN.Accelerometer2RMS * (2.1 + 0.15 * gauss(rnd));
  } else if (fault === "motor") {
    out.Current = MEAN.Current + STD.Current * (2.2 + 0.5 * gauss(rnd));
    out.Voltage = MEAN.Voltage + STD.Voltage * (-1.6 + 0.4 * gauss(rnd));
    out.Temperature = MEAN.Temperature + STD.Temperature * (1.8 + 0.2 * gauss(rnd));
  }

  for (const k of SENSOR_KEYS) {
    if (!Number.isFinite(out[k])) out[k] = MEAN[k];
  }
  return out;
}

export function formatSensor(key: SensorKey, value: number) {
  if (key.startsWith("Accelerometer")) return value.toFixed(4);
  if (key === "Pressure") return value.toFixed(3);
  if (key === "Current") return value.toFixed(3);
  return value.toFixed(2);
}
