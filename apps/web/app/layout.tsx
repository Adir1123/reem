import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Assistant } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { BackButton } from "@/components/BackButton";

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-display",
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "900"],
  display: "block",
});

const assistant = Assistant({
  variable: "--font-body",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "block",
});

export const metadata: Metadata = {
  title: "ראם — לוח בקרת קרוסלות",
  description: "ניהול קרוסלות אינסטגרם ל-@personalfinancetips",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${frankRuhl.variable} ${assistant.variable} h-full antialiased`}
    >
      <body className="bg-bg text-ink min-h-full flex flex-col font-body">
        <Nav />
        <BackButton />
        {children}
      </body>
    </html>
  );
}
