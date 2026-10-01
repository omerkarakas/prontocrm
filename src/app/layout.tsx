import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Pronto CRM", template: "%s · Pronto CRM" },
  description: "Etkinlik firmaları için e-tablo hızında müşteri ve katılımcı yönetimi.",
  icons: { icon: "/plogo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${workSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
