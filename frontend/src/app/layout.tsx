import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = "https://archflux.yusuf435.duckdns.org";

export const metadata: Metadata = {
  title: {
    default: "ArchFlux — Mimari Cephe DXF Dönüştürücü",
    template: "%s — ArchFlux",
  },
  description:
    "Yapay zeka destekli mimari cephe fotoğraflarından profesyonel DXF CAD çizimleri üretin. Saniyeler içinde hassas yapı cephesi çizimi.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "ArchFlux",
    title: "ArchFlux — Mimari Cephe DXF Dönüştürücü",
    description:
      "Yapay zeka ile mimari cephe fotoğraflarını DXF'e dönüştürün. Hızlı, hassas, profesyonel.",
    locale: "tr_TR",
  },
  twitter: {
    card: "summary",
    title: "ArchFlux — Mimari Cephe DXF Dönüştürücü",
    description:
      "Yapay zeka ile mimari cephe fotoğraflarını DXF'e dönüştürün.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <QueryProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <ThemeProvider>
                {children}
                <Toaster />
              </ThemeProvider>
            </NextIntlClientProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
