import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-lg font-bold">⬛ ArchFlux</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        {children}
      </main>
      <footer className="border-t mt-16">
        <div className="max-w-3xl mx-auto px-6 py-4 text-sm text-muted-foreground flex gap-6">
          <Link href="/privacy" className="hover:underline">Gizlilik Politikası</Link>
          <Link href="/terms" className="hover:underline">Kullanım Şartları</Link>
          <Link href="/app" className="hover:underline">Uygulamaya Dön</Link>
        </div>
      </footer>
    </div>
  );
}
