// app/layout.js
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard"; // <--- Import the new AuthGuard
import localFont from 'next/font/local';
import InstallBanner from "@/components/InstallBanner"; 

// Load custom fonts
const NRTReg = localFont({
  src: './fonts/NRT-Reg.ttf',
  display: 'swap',
  variable: '--font-nrt-reg',
});

const NRTBd = localFont({
  src: './fonts/NRT-Bd.ttf',
  display: 'swap',
  variable: '--font-nrt-bd',
});

export const metadata = {
  title: "Peshin Store",
  description: "For Derma Equipments.. ",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${NRTReg.variable} ${NRTBd.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3498db" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AranMed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="msapplication-TileColor" content="#3498db" />
      </head>
      <body className="bg-gray-50" suppressHydrationWarning>
        <AuthProvider>
          {/* Wrap everything inside the AuthGuard */}
          <AuthGuard>
            <div className="app-wrapper">
              <Navbar />
              <main className="content-scroll pt-16">{children}</main>
              <InstallBanner />
            </div>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}