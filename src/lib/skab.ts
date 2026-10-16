export const SENSOR_KEYS = [
  "Accelerometer1RMS",
  "Accelerometer2RMS",
  "Current",
  "Pressure",
  "Temperature",
  "Thermocouple",
  "Voltage",
  "VolumeFlowRateRMS",
] as const;

export type SensorKey = (typeof SENSOR_KEYS)[number];

export const SENSOR_META: Record<
  SensorKey,
  { label: string; unit: string; tag: string }
> = {
  Accelerometer1RMS: { label: "Accel 1", unit: "g RMS", tag: "PUMP_01.Accel1_RMS" },
  Accelerometer2RMS: { label: "Accel 2", unit: "g RMS", tag: "PUMP_01.Accel2_RMS" },
  Current: { label: "Current", unit: "A", tag: "PUMP_01.Current" },
  Pressure: { label: "Pressure", unit: "bar", tag: "PUMP_01.Pressure" },
  Temperature: { label: "Body temp", unit: "°C", tag: "PUMP_01.Temp_Body" },
  Thermocouple: { label: "Fluid temp", unit: "°C", tag: "PUMP_01.Temp_Fluid" },
  Voltage: { label: "Voltage", unit: "V", tag: "PUMP_01.Voltage" },
  VolumeFlowRateRMS: { label: "Flow", unit: "L/min", tag: "PUMP_01.Flow_RMS" },
};

/** Fitted on SKAB anomaly-free.csv (9405 samples). */
export const MEAN: Record<SensorKey, number> = {
  Accelerometer1RMS: 0.212604,
  Accelerometer2RMS: 0.268407,
  Current: 2.40301,
  Pressure: 0.111266,
  Temperature: 89.4723,
  Thermocouple: 28.4743,
  Voltage: 228.647,
  VolumeFlowRateRMS: 125.237,
};

export const STD: Record<SensorKey, number> = {
  Accelerometer1RMS: 0.00474,
  Accelerometer2RMS: 0.003988,
  Current: 0.48644,
  Pressure: 0.25332,
  Temperature: 0.66707,
  Thermocouple: 0.7307,
  Voltage: 10.98,
  VolumeFlowRateRMS: 1.60524,
};

/** Top-4 PCA loadings on standardized SKAB normal data. */
export const PCA_COMPONENTS: number[][] = [
  [
    0.3953364327993297, -0.427566852437685, -0.09658087029803782,
    -0.01274645286037807, -0.4496823630047192, 0.4742428087966491,
    -0.02567659733591692, 0.47289068301922565,
  ],
  [
    0.0012169792606090363, -0.05785622410123669, 0.7049059665164591,
    0.06853091314415985, -0.04632917752885993, 0.04499524164792962,
    0.6994190936830946, 0.041282387738759724,
  ],
  [
    -0.024122367760708915, -0.009836944842051892, -0.05481844210734043,
    0.99615194428971, 0.019462692282958858, 0.002496347480191465,
    -0.04439190742016093, 0.04052059472049816,
  ],
  [
    0.05585861173792786, 0.08376724516419565, -0.6937510901005863,
    -0.002382885351042653, 0.01602649288870215, -0.0037505347498499922,
    0.7108150272591105, -0.055115270219547145,
  ],
];

export type SensorVector = Record<SensorKey, number>;

export function toArray(v: SensorVector): number[] {
  return SENSOR_KEYS.map((k) => v[k]);
}

export function standardize(v: SensorVector): number[] {
  return SENSOR_KEYS.map((k) => (v[k] - MEAN[k]) / STD[k]);
}
