"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { copyDe } from "@/lib/constants/copy.de";

type ExtractResult = {
  order_ref: string | null;
  supplier_name: string | null;
  delivery_date: string | null;
  line_count: number | null;
  confidence: number;
};

type ApiResponse =
  | { extract: ExtractResult; delivered: true }
  | { extract: ExtractResult; delivered: false; reason: string }
  | { error: string };

type Props = {
  orderId: string;
  alreadyDelivered: boolean;
};

export function ConfirmDeliveryCard({ orderId, alreadyDelivered }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  if (alreadyDelivered) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="h-5 w-5" />
        <span>{copyDe["delivery.already_confirmed"]}</span>
      </div>
    );
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("photo", file);
      const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as ApiResponse;
      setResult(body);
      if ("delivered" in body && body.delivered) {
        // Server flipped status; refresh server-rendered parent.
        router.refresh();
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-zinc-900">
          {copyDe["delivery.title"]}
        </p>
        <p className="text-xs text-zinc-600">{copyDe["delivery.body"]}</p>
      </div>

      <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm font-medium text-zinc-900 hover:border-zinc-500">
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {copyDe["delivery.processing"]}
          </>
        ) : (
          <>
            <Camera className="h-5 w-5" />
            {copyDe["delivery.cta"]}
          </>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={onFileChange}
        />
      </label>

      {result && "error" in result && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {result.error}
        </p>
      )}

      {result && "extract" in result && (
        <div className="space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          <p>
            <span className="font-medium">{copyDe["delivery.field_ref"]}:</span>{" "}
            {result.extract.order_ref ?? "—"}
          </p>
          <p>
            <span className="font-medium">{copyDe["delivery.field_supplier"]}:</span>{" "}
            {result.extract.supplier_name ?? "—"}
          </p>
          <p>
            <span className="font-medium">{copyDe["delivery.field_lines"]}:</span>{" "}
            {result.extract.line_count ?? "—"}
          </p>
          <p>
            <span className="font-medium">{copyDe["delivery.field_confidence"]}:</span>{" "}
            {(result.extract.confidence * 100).toFixed(0)}%
          </p>
          {"delivered" in result && result.delivered ? (
            <p className="mt-1 flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {copyDe["delivery.success"]}
            </p>
          ) : (
            <p className="mt-1 text-amber-700">
              {"reason" in result ? result.reason : copyDe["delivery.low_confidence"]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
