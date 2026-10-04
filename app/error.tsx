"use client";

import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md border border-gray-200 dark:border-gray-700 text-center">
        <CardHeader>
          <h1 className="text-2xl font-bold text-danger">কিছু ভুল হয়েছে</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {error.message || "অপ্রত্যাশিত একটি ত্রুটি ঘটেছে।"}
          </p>
        </CardHeader>
        <CardBody className="pt-0">
          <Button onClick={reset} color="primary" className="w-full">
            আবার চেষ্টা করুন
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}