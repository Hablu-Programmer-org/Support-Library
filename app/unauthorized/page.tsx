import { Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <Card className="w-full max-w-md border border-slate-200 dark:border-slate-700 text-center">
        <CardHeader>
          <h1 className="text-2xl font-bold text-danger">অনুমতি নেই</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            আপনার এই পেজটি দেখার অনুমতি নেই।
          </p>
        </CardHeader>
        <CardBody className="pt-0">
          <Link href="/dashboard" className="text-primary hover:underline">
            ড্যাশবোর্ডে ফিরে যান
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}