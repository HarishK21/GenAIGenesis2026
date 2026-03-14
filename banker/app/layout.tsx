import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";

import { Providers } from "@/app/providers";
import { cn } from "@/lib/utils";

import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"]
});

export const metadata: Metadata = {
  title: "NorthMaple Bank",
  description: "Secure and personalized online banking experience."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={cn(bodyFont.variable, displayFont.variable, "min-h-screen font-sans antialiased")}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
