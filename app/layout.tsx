import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { PWAAppMode } from "@/components/pwa/PWAAppMode";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { PWAPremiumFeedback } from "@/components/pwa/PWAPremiumFeedback";
import { PWAServiceWorker } from "@/components/pwa/PWAServiceWorker";
import { PWAStandaloneNav } from "@/components/pwa/PWAStandaloneNav";
import PublicFooter from "@/components/PublicFooter";
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
    default: "SafariPlug — One place for your whole trip across Africa",
    template: "%s | SafariPlug",
  },
  description:
    "Plan and book stays, experiences, transfers, services, food, events and trips across Africa from one starting point.",
  applicationName: "SafariPlug",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SafariPlug",
  },
  formatDetection: {
    telephone: false,
  },
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
    title: "SafariPlug — One place for your whole trip across Africa",
    description:
      "Plan and book stays, experiences, transfers, services, food, events and trips across Africa.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "SafariPlug — One place for your whole trip across Africa",
    description:
      "Plan and book stays, experiences, transfers, services, food, events and trips across Africa.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-black text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://www.safariplug.com/#organization",
                  name: "SafariPlug",
                  url: "https://www.safariplug.com",
                  email: "info@safariplug.com",
                  telephone: "+254768240096",
                  partner: {
                    "@type": "Organization",
                    name: "Aurelian Hospitality Group",
                    url: "https://aurelianhospitalitygroup.com",
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://www.safariplug.com/#website",
                  url: "https://www.safariplug.com",
                  name: "SafariPlug",
                  description: "Plan and book stays, experiences, transfers, services, food, events and trips across Africa.",
                  publisher: { "@id": "https://www.safariplug.com/#organization" },
                },
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
        <ToastProvider>{children}</ToastProvider>
        <PublicFooter />
        <PWAAppMode />
        <PWAPremiumFeedback />
        <PWAStandaloneNav />
        <PWAServiceWorker />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
