"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { exportAllOdExcel } from "@/actions/od";
import { odSetupHint } from "@/components/calendar/od-status-badge";
import { downloadBase64Xlsx } from "@/lib/excel/download";
import { Button } from "@/components/ui/button";

export function OdExportButton() {
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const result = await exportAllOdExcel();
      if (!result.success) {
        toast.error(odSetupHint(result.error));
        return;
      }
      downloadBase64Xlsx(result.data.base64, result.data.filename);
      toast.success(`Exported ${result.data.count} OD rows`);
    });
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={pending}>
      {pending ? "Exporting…" : "Export all OD"}
    </Button>
  );
}
