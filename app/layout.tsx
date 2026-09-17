import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue, Baloo_2 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Show-branding fonts: shows.theme_font picks between these two moods.
const themeBold = Bebas_Neue({
  variable: "--font-theme-bold",
  weight: "400",
  subsets: ["latin"],
});

const themePlayful = Baloo_2({
  variable: "--font-theme-playful",
  weight: ["600", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fantasy TV",
  description: "Fantasy sport-style leagues for your favorite reality TV shows.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${themeBold.variable} ${themePlayful.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
