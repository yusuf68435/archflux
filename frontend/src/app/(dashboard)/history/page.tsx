"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobHistory } from "@/hooks/use-job";

export default function HistoryPage() {
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useJobHistory(page);
  const jobs = data?.jobs || [];

  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
    COMPLETED: { variant: "default" },
    PROCESSING: { variant: "secondary" },
    QUEUED: { variant: "outline" },
    PENDING: { variant: "outline" },
    FAILED: { variant: "destructive" },
    CANCELLED: { variant: "destructive" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">{t("noJobs")}</p>
            <a href="/">
              <Button className="mt-4">{t("startFirst")}</Button>
            </a>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {jobs.map((job) => {
          const sc = statusConfig[job.status] || { variant: "outline" as const };
          return (
            <Card key={job.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {job.outputPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.outputPreviewUrl} alt="Preview" className="h-full w-full rounded object-cover" />
                  ) : (
                    <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t(`jobTypes.${job.type}`)}</span>
                    <Badge variant={sc.variant}>{t(`status.${job.status}`)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()} • {job.creditsCost} {t("credits")}
                  </p>
                </div>
                {job.status === "COMPLETED" && job.outputDxfUrl && (
                  <a href={job.outputDxfUrl} download>
                    <Button size="sm" variant="outline">{t("download")}</Button>
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            {tc("back")}
          </Button>
          <Button variant="outline" size="sm" disabled={jobs.length < data.pageSize} onClick={() => setPage(p => p + 1)}>
            {tc("next")}
          </Button>
        </div>
      )}
    </div>
  );
}
