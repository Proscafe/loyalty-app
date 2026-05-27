import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loyalty Program",
  description: "Earn stamps. Redeem free items.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#faf7f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Distinctive type pairing: Fraunces (display) + Inter Tight (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&family=Inter+Tight:wght@400;500;600;700&display=swap"
        />
        <style>{`
          :root {
            --font-sans: "Inter Tight", ui-sans-serif, system-ui, sans-serif;
            --font-display: "Fraunces", Georgia, serif;
          }
          body { font-family: var(--font-sans); }
          .font-display { font-family: var(--font-display); font-feature-settings: "ss01" on, "ss02" on; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
