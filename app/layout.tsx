import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/google-analytics";
import { Navbar } from "@/components/navbar";
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
  title: "Audit Patrimoine — Conseil patrimonial",
  description:
    "Civil, fiscal et financier : ressources et outils pour votre accompagnement patrimonial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <Navbar />
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
        <footer
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '1.25rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          © {new Date().getFullYear()} Audit Patrimoine · Outil pédagogique, non contractuel
        </footer>
      </body>
    </html>
  );
}
