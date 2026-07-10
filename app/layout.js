// app/layout.js
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";
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
  title: "Aran Med Store",
  description: "For Medical Equipments.. (+964) 772 533 5252",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${NRTReg.variable} ${NRTBd.variable}`}>
       <head>
        {/* Add these lines */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3498db" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-gray-50" suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <InstallBanner />
        </AuthProvider>
      </body>
    </html>
  );
}

