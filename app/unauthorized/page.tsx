import { Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md border border-gray-200 dark:border-gray-700 text-center">
        <CardHeader>
          <h1 className="text-2xl font-bold text-danger">অনুমতি নেই</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
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