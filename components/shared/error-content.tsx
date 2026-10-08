"use client";

import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { useEffect } from "react";

type ErrorContentProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /**
   * Shown under the heading. Must stay generic: `error.message` from a
   * server action can contain internal detail (e.g. a raw Zod dump),
   * so it is logged here and never rendered.
   */
  message: string;
};

export function ErrorContent({ error, reset, message }: ErrorContentProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="w-full max-w-md border border-slate-200 text-center dark:border-slate-700">
      <CardHeader className="flex flex-col items-center">
        <h1 className="text-2xl font-bold text-danger">Something Went Wrong</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </CardHeader>
      <CardBody className="pt-0">
        <Button onClick={reset} color="primary" className="w-full">
          Try Again
        </Button>
      </CardBody>
    </Card>
  );
}
