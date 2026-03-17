"use client";

import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const { data: session } = useSession();
  const user = session?.user;
  const credits = (user as Record<string, unknown>)?.credits as number ?? 0;
  const role = (user as Record<string, unknown>)?.role as string;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link href="/app" className="flex items-center gap-2 font-bold text-lg">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
          ArchFlux
        </Link>

        <div className="flex-1" />

        {user && (
          <Link href="/credits">
            <Badge variant="secondary" className="cursor-pointer px-3 py-1">
              {credits} {t("credits")}
            </Badge>
          </Link>
        )}

        {role === "ADMIN" && (
          <Link href="/admin">
            <Button variant="ghost" size="sm">{t("admin")}</Button>
          </Link>
        )}

        <ThemeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={user.image || ""} alt={user.name || ""} />
                <AvatarFallback>{user.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <div className="flex items-center gap-2 p-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <Link href="/history"><DropdownMenuItem>{t("history")}</DropdownMenuItem></Link>
              <Link href="/credits"><DropdownMenuItem>{t("credits")}</DropdownMenuItem></Link>
              <Link href="/settings"><DropdownMenuItem>{t("settings")}</DropdownMenuItem></Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>{ta("signOut")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
