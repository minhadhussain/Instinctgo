import type { Metadata } from "next";
import { Barlow_Condensed, Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  style: "italic",
  display: "swap",
  variable: "--font-playfair",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "InstinctGo — From physical files to verified action",
  description:
    "The physical-to-action agentic workflow platform for universities and government departments. Administrative noting, financial scrutiny, and evidence-backed approvals in one Digital Green Sheet workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${playfairDisplay.variable} ${barlowCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
