import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { InteractiveTour } from "@/components/InteractiveTour";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0e17",
};

export const metadata: Metadata = {
  title: "HyperCopy | Plataforma de Copy Trading en Hyperliquid",
  description: "Copia automáticamente a los mejores traders de Hyperliquid DEX con carteras simuladas y alertas en tiempo real por Telegram.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HyperCopy",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "HyperCopy",
    "application-name": "HyperCopy",
    "msapplication-TileColor": "#0a0e17",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HyperCopy" />
        <meta name="application-name" content="HyperCopy" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var raw = localStorage.getItem("hyperliquid_copy_user_profile_v2");
                if (raw) {
                  var p = JSON.parse(raw);
                  if (p && p.trading_mode === "REAL") {
                    document.documentElement.setAttribute("data-theme", "real");
                  } else {
                    document.documentElement.setAttribute("data-theme", "demo");
                  }
                } else {
                  document.documentElement.setAttribute("data-theme", "demo");
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-gray-100 flex flex-col">
        <Navbar />
        <InteractiveTour />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
