"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto p-8 text-center space-y-4 pt-20">
      <p className="text-4xl opacity-30">!</p>
      <h2 className="text-xl font-semibold">出了点问题</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "页面加载失败，请重试。"}
      </p>
      <Button variant="outline" onClick={reset}>
        重试
      </Button>
      <div>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          返回首页
        </Link>
      </div>
    </div>
  );
}
