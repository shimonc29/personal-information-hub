import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "מרכזשלי — המידע שלך, בדרך שלך";
  const description = "עושים סדר ב־Drive תוך 5 דקות ומנהלים את המידע איך שנוח לך.";
  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, locale: "he_IL", type: "website", images: [{ url: `${origin}/og.png`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
