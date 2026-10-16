import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Pause,
  Play,
  Radio,
  RotateCcw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { MODEL_LABEL, type ModelId } from "@/lib/models";
import { FAULT_META, formatSensor, type FaultId } from "@/lib/plant";
import { SENSOR_KEYS, SENSOR_META } from "@/lib/skab";
import {
  currentThreshold,
  tagRows,
  useConsole,
  type Sample,
} from "@/lib/store";
import { cn } from "@/lib/utils";

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

export function ConsoleApp() {
  return <LiveConsole />;
}

function LiveConsole() {
  const running = useConsole((s) => s.running);
  const step = useConsole((s) => s.step);
  const useService = useConsole((s) => s.useService);
  const model = useConsole((s) => s.model);
  const quantile = useConsole((s) => s.quantile);
  const fnCost = useConsole((s) => s.fnCost);
  const pushApi = useConsole((s) => s.pushApi);
  const rnd = useRef(mulberry32(7));

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(async () => {
      const sample = step(rnd.current);
      if (useService) {
        const t0 = performance.now();
        try {
          const thr = currentThreshold(model, quantile, fnCost);
          const res = await fetch("/api/infer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sensors: sample.sensors,
              model: model === "zscore" ? "autoencoder" : model,
              threshold: thr,
            }),
          });
          const body = await res.json();
          pushApi(
            {
              at: Date.now(),
              ms: Math.round(performance.now() - t0),
              ok: res.ok,
              body,
              status: res.status,
            },
            res.ok
              ? {
                  score: body.score,
                  anomaly: body.anomaly,
                  threshold: body.threshold,
                  model: body.model,
                }
              : undefined,
          );
        } catch (err) {
          pushApi({
            at: Date.now(),
            ms: Math.round(performance.now() - t0),
            ok: false,
            body: { error: String(err) },
            status: 0,
          });
        }
      }
    }, 280);
    return () => window.clearInterval(id);
  }, [running, step, useService, model, quantile, fnCost, pushApi]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-fg">
      <TopBar />
      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-12 min-w-0">
        <section className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <ControlsCard />
          <CostCard />
        </section>
        <section className="flex min-w-0 flex-col gap-4 lg:col-span-6">
          <ScoreCard />
          <SensorsCard />
        </section>
        <section className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <AlarmBanner />
          <TagsCard />
          <RoutineCard />
        </section>
        <section className="min-w-0 lg:col-span-12">
          <ServiceCard />
        </section>
      </main>
    </div>
  );
}

function TopBar() {
  const running = useConsole((s) => s.running);
  const toggle = useConsole((s) => s.toggleRun);
  const reset = useConsole((s) => s.reset);
  const tick = useConsole((s) => s.tick);
  const fault = useConsole((s) => s.fault);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold tracking-tight">Loop Sentinel</p>
            <p className="font-mono text-xs text-muted">PUMP-01 · water circuit</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusChip
            ok={fault === "none"}
            label={fault === "none" ? "PROCESS OK" : FAULT_META[fault].label.toUpperCase()}
          />
          <span className="font-mono text-xs text-muted tabular-nums">
            t={tick.toString().padStart(4, "0")}
          </span>
          <Button variant="subtle" onClick={toggle} aria-label={running ? "Pause" : "Run"}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pause" : "Run"}
          </Button>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </div>
    </header>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full px-3 font-mono text-xs tracking-wide",
        ok ? "bg-ok/15 text-ok" : "bg-alarm/20 text-alarm",
      )}
    >
      {label}
    </span>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ControlsCard() {
  const fault = useConsole((s) => s.fault);
  const setFault = useConsole((s) => s.setFault);
  const model = useConsole((s) => s.model);
  const setModel = useConsole((s) => s.setModel);
  const useService = useConsole((s) => s.useService);
  const setUseService = useConsole((s) => s.setUseService);

  return (
    <Panel title="Plant & detector">
      <p className="mb-3 text-sm text-muted">Inject a SKAB-style fault, then watch tags flip.</p>
      <div className="flex flex-col gap-2">
        {(Object.keys(FAULT_META) as FaultId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFault(id)}
            className={cn(
              "min-h-11 rounded-md px-3 py-2 text-left transition-opacity duration-150",
              fault === id ? "bg-surface-2 shadow-[var(--shadow-border)]" : "hover:bg-surface-2/60",
            )}
          >
            <span className="block text-sm font-medium">{FAULT_META[id].label}</span>
            <span className="block text-xs text-muted">{FAULT_META[id].blurb}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Model</p>
        <div className="grid grid-cols-1 gap-1">
          {(Object.keys(MODEL_LABEL) as ModelId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setModel(id)}
              className={cn(
                "min-h-11 rounded-md px-3 text-left text-sm",
                model === id ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg",
              )}
            >
              {MODEL_LABEL[id]}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={useService}
          onChange={(e) => setUseService(e.target.checked)}
          className="size-4 accent-primary"
        />
        Route scores through inference service
      </label>
    </Panel>
  );
}

function CostCard() {
  const fnCost = useConsole((s) => s.fnCost);
  const setFnCost = useConsole((s) => s.setFnCost);
  const quantile = useConsole((s) => s.quantile);
  const setQuantile = useConsole((s) => s.setQuantile);
  const c = useConsole((s) => s.confusion);
  const total = c.tp + c.fp + c.fn + c.tn;
  const prec = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 0;
  const rec = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0;
  const far = c.fp + c.tn ? c.fp / (c.fp + c.tn) : 0;
  const mar = c.fn + c.tp ? c.fn / (c.fn + c.tp) : 0;
  const cost = c.fp * 1 + c.fn * fnCost;

  return (
    <Panel title="False-alarm cost">
      <label className="block text-sm">
        Missed fault costs {fnCost}× a false alarm
        <input
          type="range"
          min={1}
          max={20}
          value={fnCost}
          onChange={(e) => setFnCost(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      </label>
      <label className="mt-3 block text-sm">
        Tightness {Math.round(quantile * 100)}%
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.02}
          value={quantile}
          onChange={(e) => setQuantile(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      </label>
      <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
        <Stat k="Precision" v={pct(prec)} />
        <Stat k="Recall" v={pct(rec)} />
        <Stat k="FAR" v={pct(far)} />
        <Stat k="MAR" v={pct(mar)} />
        <Stat k="Rel. cost" v={cost.toFixed(0)} />
        <Stat k="Samples" v={String(total)} />
      </dl>
      <p className="mt-3 text-xs text-muted">
        Injected faults count as true events. Higher miss-cost lowers the threshold so the PLC trips earlier.
      </p>
    </Panel>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-sm bg-surface-2 px-2 py-2">
      <dt className="text-subtle">{k}</dt>
      <dd className="text-sm text-fg">{v}</dd>
    </div>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function ScoreCard() {
  const history = useConsole((s) => s.history);
  const model = useConsole((s) => s.model);
  const quantile = useConsole((s) => s.quantile);
  const fnCost = useConsole((s) => s.fnCost);
  const last = history[history.length - 1];
  const thr = currentThreshold(model, quantile, fnCost);
  const score = last ? last.scores[model] : 0;
  const anomaly = score >= thr;
  const data = useMemo(
    () =>
      history.map((h) => ({
        t: h.t,
        score: Number(h.scores[model].toFixed(4)),
        thr,
      })),
    [history, model, thr],
  );

  return (
    <Panel
      title="Anomaly score"
      action={
        <span className={cn("font-mono text-sm tabular-nums", anomaly ? "text-alarm" : "text-ok")}>
          {score.toFixed(3)} / {thr.toFixed(3)}
        </span>
      }
    >
      <div className="h-44 min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <RTooltip
              contentStyle={{
                background: "#15181d",
                border: "1px solid rgba(230,232,235,0.12)",
                borderRadius: 8,
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="thr" stroke="#6a717b" fill="none" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="score"
              stroke={anomaly ? "#c45c4a" : "#9eb0c2"}
              fill={anomaly ? "rgba(196,92,74,0.18)" : "rgba(158,176,194,0.16)"}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function SensorsCard() {
  const history = useConsole((s) => s.history);
  const last = history[history.length - 1];
  return (
    <Panel title="Sensor bus">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SENSOR_KEYS.map((k) => (
          <Spark key={k} k={k} history={history} value={last?.sensors[k]} />
        ))}
      </div>
    </Panel>
  );
}

function Spark({
  k,
  history,
  value,
}: {
  k: (typeof SENSOR_KEYS)[number];
  history: Sample[];
  value?: number;
}) {
  const meta = SENSOR_META[k];
  const pts = history.slice(-48).map((h) => h.sensors[k]);
  const min = Math.min(...pts, value ?? 0);
  const max = Math.max(...pts, value ?? 1);
  const span = max - min || 1;
  return (
    <div className="rounded-md bg-surface-2 p-2">
      <p className="text-xs text-muted">{meta.label}</p>
      <p className="font-mono text-sm tabular-nums">
        {value === undefined ? "—" : formatSensor(k, value)}{" "}
        <span className="text-subtle">{meta.unit}</span>
      </p>
      <div className="mt-2 flex h-8 items-end gap-px">
        {pts.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-primary/70"
            style={{ height: `${((v - min) / span) * 100}%`, minHeight: 2 }}
          />
        ))}
      </div>
    </div>
  );
}

function AlarmBanner() {
  const history = useConsole((s) => s.history);
  const model = useConsole((s) => s.model);
  const quantile = useConsole((s) => s.quantile);
  const fnCost = useConsole((s) => s.fnCost);
  const last = history[history.length - 1];
  const thr = currentThreshold(model, quantile, fnCost);
  const anomaly = last ? last.scores[model] >= thr : false;

  return (
    <div
      className={cn(
        "rounded-xl p-4 shadow-[var(--shadow-border)]",
        anomaly ? "bg-alarm/15" : "bg-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("size-5 shrink-0", anomaly ? "text-alarm" : "text-ok")} />
        <div>
          <p className="text-sm font-medium">
            {anomaly ? "AD_01.Anomaly = 1 — slow pump, raise alarm" : "AD_01.Anomaly = 0 — run as commanded"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Same BOOL a Logix routine would consume from the edge module.
          </p>
        </div>
      </div>
    </div>
  );
}

function TagsCard() {
  const history = useConsole((s) => s.history);
  const model = useConsole((s) => s.model);
  const quantile = useConsole((s) => s.quantile);
  const fnCost = useConsole((s) => s.fnCost);
  const last = history[history.length - 1];
  const thr = currentThreshold(model, quantile, fnCost);
  const score = last ? last.scores[model] : 0;
  const rows = tagRows(last?.sensors, score, score >= thr, thr, model);

  return (
    <Panel title="Controller tags">
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="text-subtle">
            <tr>
              <th className="pb-2 font-medium">Tag</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-border">
                <td className="max-w-[9rem] break-all py-1.5 pr-2 text-fg">{r.name}</td>
                <td className="py-1.5 pr-2 text-muted">{r.type}</td>
                <td
                  className={cn(
                    "py-1.5 tabular-nums",
                    r.name.endsWith("Anomaly") && r.value === "1" ? "text-alarm" : "text-fg",
                  )}
                >
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RoutineCard() {
  const history = useConsole((s) => s.history);
  const model = useConsole((s) => s.model);
  const quantile = useConsole((s) => s.quantile);
  const fnCost = useConsole((s) => s.fnCost);
  const last = history[history.length - 1];
  const thr = currentThreshold(model, quantile, fnCost);
  const anomaly = last ? last.scores[model] >= thr : false;

  return (
    <Panel title="Studio 5000 routine">
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-xs leading-relaxed text-muted">
        {`(* AD_01 written by edge infer *)
IF AD_01.Anomaly THEN
  PUMP_01.Cmd_Speed := PUMP_01.Cmd_Speed * 0.70;
  Alm_PredMaint.Set := 1;
END_IF;`}
      </pre>
      <p className={cn("mt-2 font-mono text-xs", anomaly ? "text-alarm" : "text-ok")}>
        {anomaly ? "THEN branch active — speed derate 30%" : "THEN skipped — speed unchanged"}
      </p>
    </Panel>
  );
}

function ServiceCard() {
  const last = useConsole((s) => s.history[s.history.length - 1]);
  const model = useConsole((s) => s.model);
  const quantile = useConsole((s) => s.quantile);
  const fnCost = useConsole((s) => s.fnCost);
  const log = useConsole((s) => s.apiLog);
  const pushApi = useConsole((s) => s.pushApi);
  const [busy, setBusy] = useState(false);

  async function sendOnce() {
    if (!last) return;
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sensors: last.sensors,
          model: model === "zscore" ? "autoencoder" : model,
          threshold: currentThreshold(model, quantile, fnCost),
        }),
      });
      const body = await res.json();
      pushApi({
        at: Date.now(),
        ms: Math.round(performance.now() - t0),
        ok: res.ok,
        body,
        status: res.status,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Inference service"
      action={
        <Button variant="subtle" onClick={sendOnce} disabled={busy || !last}>
          <Radio className="size-4" />
          POST current sample
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">
        Isolation Forest and the linear autoencoder sit behind <span className="font-mono text-fg">POST /api/infer</span>.
        A PLC, MQTT bridge, or FactoryTalk module can post the eight sensor tags and write back{" "}
        <span className="font-mono text-fg">AD_01.Anomaly</span>.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-xs text-muted">
          {`POST /api/infer
{
  "model": "autoencoder",
  "sensors": { "Current": 2.41, "Voltage": 228.6, … }
}`}
        </pre>
        <div className="max-h-48 overflow-auto rounded-md bg-bg p-3 font-mono text-xs">
          {log.length === 0 ? (
            <p className="text-subtle">No calls yet. Send a sample or enable live routing.</p>
          ) : (
            log
              .slice()
              .reverse()
              .map((e, i) => (
                <p key={i} className={e.ok ? "text-ok" : "text-alarm"}>
                  {e.status} · {e.ms}ms · {JSON.stringify(e.body).slice(0, 180)}
                </p>
              ))
          )}
        </div>
      </div>
    </Panel>
  );
}
