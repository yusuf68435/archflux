import { Header } from "@/components/layout/header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
