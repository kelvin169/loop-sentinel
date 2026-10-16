# Loop Sentinel

Live industrial console that watches a simulated pump circuit, scores multivariate sensor streams for faults, and writes the result as PLC-style tags.

A control engineer can inject a fault, compare three unsupervised detectors, and see the same decision a Studio 5000 routine would read: a REAL score, a REAL threshold, and a BOOL alarm.

This is a portfolio demo inspired by the [Skoltech Anomaly Benchmark (SKAB)](https://github.com/waico/SKAB) water-circuit data. It is not a certified Rockwell or plant-floor product.

## What it does

Each tick the plant emits eight channels:

| Channel | What it represents |
| --- | --- |
| Accelerometer 1 / 2 RMS | Vibration |
| Current, Voltage | Motor electrical load |
| Pressure, Volume flow | Hydraulic loop |
| Body temperature, thermocouple | Thermal state |

Healthy samples stay near the SKAB normal mean and standard deviation, with a little drift. Three injected faults change several channels together:

- **Valve pinch** — flow drops, pressure and current rise
- **Shaft imbalance** — both vibration channels jump
- **Motor stress** — current, voltage, and temperature wander

Three detectors score every sample without training on labeled faults:

- **Rolling z-score** — largest absolute z inside a recent window. Cheap and readable, weak on coordinated shifts.
- **Isolation Forest** — random trees fit on normal data. Points that isolate quickly score high.
- **PCA autoencoder** — reconstructs the sample from the healthy principal components. High reconstruction error means the point left the normal manifold.

A cost slider lowers the threshold when a missed fault is more expensive than a false trip. The console tracks precision, recall, false-alarm rate, miss rate, and a simple cost of `1 × false alarms + missed-fault cost × misses`.

The decision is published as controller tags:

- `PUMP_01.*` sensor REALs
- `AD_01.Score` and `AD_01.Threshold`
- `AD_01.Anomaly` (BOOL)
- `AD_01.Model` (DINT: 0 z-score, 1 isolation forest, 2 autoencoder)

A structured-text sketch on the page derates pump speed when `AD_01.Anomaly` is true.

## Inference service

The same scoring code is exposed over HTTP so an edge module or PLC gateway can call it.

`POST /api/infer`

```json
{
  "model": "autoencoder",
  "sensors": {
    "Accelerometer1RMS": 0.21,
    "Accelerometer2RMS": 0.27,
    "Current": 2.4,
    "Pressure": 0.11,
    "Temperature": 89.5,
    "Thermocouple": 28.5,
    "Voltage": 228.6,
    "VolumeFlowRateRMS": 125.2
  }
}
```

Optional `threshold` overrides the healthy quantile for that model. The JSON response includes the score, the anomaly flag, and the tag list. The console can also route each live sample through this endpoint and log the round trip.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by the dev server. Use **Valve pinch**, **Shaft imbalance**, or **Motor stress**, switch detectors, and move the cost and tightness sliders.

## Layout

| Path | Role |
| --- | --- |
| `src/lib/plant.ts` | Healthy circulation and fault injection |
| `src/lib/skab.ts` | Sensor names, healthy mean/std, PCA loadings |
| `src/lib/models.ts` | Rolling z-score, Isolation Forest, PCA autoencoder |
| `src/lib/store.ts` | Live history, threshold policy, confusion counts |
| `src/lib/infer.ts` | Shared scoring used by the UI and the API |
| `src/routes/api/infer.ts` | `GET` / `POST /api/infer` |
| `src/components/console/console-app.tsx` | Control-room interface |

## Stack

TypeScript, React, TanStack Start, Zustand, Recharts.

## Limits

The plant is simulated. Models are fit on healthy statistics, not a full production training pipeline. Tag names and the structured-text routine show how the score would land in a Logix program; they do not talk to a real controller.
