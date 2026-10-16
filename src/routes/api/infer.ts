import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runInference, type InferRequest } from "@/lib/infer";
import { SENSOR_KEYS } from "@/lib/skab";

const BodySchema = z.object({
  sensors: z
    .record(z.string(), z.number().finite())
    .refine((o) => SENSOR_KEYS.every((k) => typeof o[k] === "number"), {
      message: "All eight sensor keys are required",
    }),
  model: z.enum(["zscore", "iforest", "autoencoder"]).optional(),
  threshold: z.number().finite().optional(),
});

export const Route = createFileRoute("/api/infer")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          service: "loop-sentinel-infer",
          version: "1.0",
          models: ["iforest", "autoencoder"],
          topic: "plant/pump01/ad",
          usage:
            "POST JSON { sensors: { Accelerometer1RMS, ... 8 keys }, model?, threshold? }",
        }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid body", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const result = runInference(parsed.data as InferRequest);
        return Response.json(result);
      },
    },
  },
});
