import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.safariplug.com"),
  title: {
    default: "SafariPlug — Discover What's Happening Across Africa",
    template: "%s | SafariPlug",
  },
  description:
    "SafariPlug Intelligence discovers events, experiences, hidden gems and places worth knowing across Africa.",
  applicationName: "SafariPlug",
  keywords: [
    "Africa events",
    "Nairobi events",
    "Mombasa events",
    "Kenya experiences",
    "things to do in Kenya",
    "Africa travel",
    "SafariPlug",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "SafariPlug",
    title: "SafariPlug — Discover What's Happening Across Africa",
    description:
      "AI-powered discovery of events, experiences and places worth knowing across Africa.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "SafariPlug — Discover What's Happening Across Africa",
    description:
      "AI-powered discovery of events, experiences and places worth knowing across Africa.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-black text-white antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
