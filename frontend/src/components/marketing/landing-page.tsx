"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceTRY: number;
  popular: boolean;
}

export function LandingPage() {
  const t = useTranslations("marketing");
  const [packages, setPackages] = useState<CreditPackage[]>([]);

  useEffect(() => {
    fetch("/api/credits/packages")
      .then((r) => r.json())
      .then((data) => setPackages(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex h-14 items-center px-4 gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            ArchFlux
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/login">
            <Button variant="outline" size="sm">{t("ctaLogin")}</Button>
          </Link>
          <Link href="/login">
            <Button size="sm">{t("ctaStart")}</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 gap-6">
        <Badge variant="secondary" className="px-4 py-1 text-xs">AI-Powered CAD Conversion</Badge>
        <h1 className="text-4xl md:text-5xl font-bold max-w-3xl leading-tight">
          {t("heroTitle")}
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          {t("heroSubtitle")}
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/login">
            <Button size="lg" className="px-8">{t("ctaStart")}</Button>
          </Link>
          <Link href="#how-it-works">
            <Button size="lg" variant="outline" className="px-8">{t("howItWorksTitle")}</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/40 py-20 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l.096.04A9 9 0 0119.5 16h.002a2.25 2.25 0 001.348-.798l.25-.325" />
                </svg>
              ),
              title: t("feature1Title"),
              desc: t("feature1Desc"),
            },
            {
              icon: (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              ),
              title: t("feature2Title"),
              desc: t("feature2Desc"),
            },
            {
              icon: (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              ),
              title: t("feature3Title"),
              desc: t("feature3Desc"),
            },
          ].map((f) => (
            <div key={f.title} className="flex flex-col gap-3 p-6 bg-background rounded-xl border">
              <div className="text-primary">{f.icon}</div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t("howItWorksTitle")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: 1, title: t("step1Title"), desc: t("step1Desc") },
              { n: 2, title: t("step2Title"), desc: t("step2Desc") },
              { n: 3, title: t("step3Title"), desc: t("step3Desc") },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center text-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {packages.length > 0 && (
        <section className="bg-muted/40 py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-3">{t("pricingTitle")}</h2>
            <p className="text-center text-muted-foreground mb-12">{t("pricingSubtitle")}</p>
            <div className="grid md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative flex flex-col gap-4 p-6 bg-background rounded-xl border ${
                    pkg.popular ? "border-primary ring-2 ring-primary" : ""
                  }`}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">
                      Popular
                    </Badge>
                  )}
                  <div>
                    <p className="font-semibold text-lg">{pkg.name}</p>
                    <p className="text-3xl font-bold mt-1">
                      {pkg.credits} <span className="text-base font-normal text-muted-foreground">{t("credits")}</span>
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ₺{pkg.priceTRY} — ₺{(pkg.priceTRY / pkg.credits).toFixed(2)} {t("perCredit")}
                  </p>
                  <Link href="/login">
                    <Button className="w-full" variant={pkg.popular ? "default" : "outline"}>
                      {t("ctaStart")}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            ArchFlux
          </div>
          <p>{t("footerDesc")}</p>
          <p>© {new Date().getFullYear()} ArchFlux. {t("footerRights")}</p>
        </div>
      </footer>
    </div>
  );
}
