import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-3xl space-y-8">
          <span className="inline-flex w-fit rounded-full border border-primary-400/40 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-200">
            Hablu Programmer Staff Tool
          </span>
          <div className="space-y-5">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              সাপোর্ট কেস থেকে reusable solution library তৈরি করুন
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              প্রতিদিনের student support question, answer, external file link এবং video summary এক জায়গায় সংরক্ষণ করে দ্রুত খুঁজে বের করার জন্য staff-first support library.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              স্টাফ লগইন
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              ড্যাশবোর্ডে যান
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
