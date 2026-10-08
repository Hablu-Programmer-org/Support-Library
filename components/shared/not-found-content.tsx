import Link from "next/link";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";

/**
 * Shared body for the two not-found boundaries (root and dashboard).
 * Keeping it in one place means the 404 the user sees from a deep
 * dashboard route and the 404 from an unknown top-level URL look the
 * same and both offer a way back.
 */
export function NotFoundContent() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border border-slate-200 text-center dark:border-slate-700">
        <CardHeader className="flex flex-col items-center">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This page could not be found.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The link may be incorrect, or the record may have been archived.
          </p>
          <Link href="/dashboard" className="block">
            <Button color="primary" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
