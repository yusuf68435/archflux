import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function RootPage() {
  const session = await auth();
  if (session) redirect("/app");
  return <LandingPage />;
}
