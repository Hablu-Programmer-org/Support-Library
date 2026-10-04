import { Card, CardBody, CardHeader } from "@heroui/react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>সাপোর্ট কেস</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">মোট কেস</p>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>সলিউশন আর্টিকেল</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">মোট আর্টিকেল</p>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>এই সপ্তাহের কেস</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">নতুন কেস</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}