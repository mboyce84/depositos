import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "DepositOS — The operating system for your rebuild",
    description: "Track the daily deposits that build your future self across health, faith, family, business, and personal growth.",
    openGraph: {
      title: "DepositOS",
      description: "The operating system for your rebuild. One deposit at a time.",
      images: [{ url: `${origin}/og.jpg`, width: 1600, height: 835, alt: "DepositOS — The operating system for your rebuild" }],
    },
    twitter: { card: "summary_large_image", title: "DepositOS", description: "The operating system for your rebuild.", images: [`${origin}/og.jpg`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
