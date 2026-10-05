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
    <Card className="w-full max-w-md border border-gray-200 text-center dark:border-gray-700">
      <CardHeader className="flex flex-col items-center">
        <h1 className="text-2xl font-bold text-danger">কিছু ভুল হয়েছে</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      </CardHeader>
      <CardBody className="pt-0">
        <Button onClick={reset} color="primary" className="w-full">
          আবার চেষ্টা করুন
        </Button>
      </CardBody>
    </Card>
  );
}