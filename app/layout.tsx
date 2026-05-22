import type { Metadata } from "next";
import "./globals.css";
import { Geist, Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
// Display font for hero numbers + section headings. Pairs with Geist's
// neutral body. Reads well on both mobile and desktop.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Site Order",
  description:
    "C-Material schnell bestellen — Schrauben, Handschuhe, Klebeband, Spraydosen.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#fafaf9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={cn(
        "h-full antialiased",
        "font-sans",
        geist.variable,
        jakarta.variable,
      )}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
