"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// The animated Uiverse Wi-Fi Loader
const AuthLoader = () => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(255, 255, 255, 0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999999 }}>
    <style>{`
      .bf-wifi-loader { --front-color: #ef4d86; --front-color-in: #fbb216; --back-color: #c3c8de; --text-color: #414856; width: 64px; height: 64px; border-radius: 50px; position: relative; display: flex; justify-content: center; align-items: center; }
      .bf-wifi-loader svg { position: absolute; display: flex; justify-content: center; align-items: center; }
      .bf-wifi-loader svg circle { position: absolute; fill: none; stroke-width: 6px; stroke-linecap: round; stroke-linejoin: round; transform: rotate(-100deg); transform-origin: center; }
      .bf-wifi-loader svg circle.back { stroke: var(--back-color); }
      .bf-wifi-loader svg circle.front { stroke: var(--front-color); }
      .bf-wifi-loader svg.circle-outer { height: 86px; width: 86px; }
      .bf-wifi-loader svg.circle-outer circle { stroke-dasharray: 62.75 188.25; }
      .bf-wifi-loader svg.circle-outer circle.back { animation: circle-outer135 1.8s ease infinite 0.3s; }
      .bf-wifi-loader svg.circle-outer circle.front { animation: circle-outer135 1.8s ease infinite 0.15s; }
      .bf-wifi-loader svg.circle-middle { height: 60px; width: 60px; }
      .bf-wifi-loader svg.circle-middle circle { stroke: var(--front-color-in); stroke-dasharray: 42.5 127.5; }
      .bf-wifi-loader svg.circle-middle circle.back { animation: circle-middle6123 1.8s ease infinite 0.25s; }
      .bf-wifi-loader svg.circle-middle circle.front { animation: circle-middle6123 1.8s ease infinite 0.1s; }
      .bf-wifi-loader svg.circle-inner { height: 34px; width: 34px; }
      .bf-wifi-loader svg.circle-inner circle { stroke-dasharray: 22 66; }
      .bf-wifi-loader svg.circle-inner circle.back { animation: circle-inner162 1.8s ease infinite 0.2s; }
      .bf-wifi-loader svg.circle-inner circle.front { animation: circle-inner162 1.8s ease infinite 0.05s; }
      .bf-wifi-loader .text { position: absolute; bottom: -40px; display: flex; justify-content: center; align-items: center; text-transform: lowercase; font-weight: 600; font-size: 15px; letter-spacing: 0.2px; }
      .bf-wifi-loader .text::before, .bf-wifi-loader .text::after { content: attr(data-text); }
      .bf-wifi-loader .text::before { color: var(--text-color); }
      .bf-wifi-loader .text::after { color: var(--front-color-in); animation: text-animation76 3.6s ease infinite; position: absolute; left: 0; }
      @keyframes circle-outer135 { 0% { stroke-dashoffset: 25; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 301; } 80% { stroke-dashoffset: 276; } 100% { stroke-dashoffset: 276; } }
      @keyframes circle-middle6123 { 0% { stroke-dashoffset: 17; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 204; } 80% { stroke-dashoffset: 187; } 100% { stroke-dashoffset: 187; } }
      @keyframes circle-inner162 { 0% { stroke-dashoffset: 9; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 106; } 80% { stroke-dashoffset: 97; } 100% { stroke-dashoffset: 97; } }
      @keyframes text-animation76 { 0% { clip-path: inset(0 100% 0 0); } 50% { clip-path: inset(0); } 100% { clip-path: inset(0 0 0 100%); } }
    `}</style>
    <div className="bf-wifi-loader">
      <svg className="circle-outer" viewBox="0 0 86 86"><circle className="back" cx="43" cy="43" r="40"></circle><circle className="front" cx="43" cy="43" r="40"></circle></svg>
      <svg className="circle-middle" viewBox="0 0 60 60"><circle className="back" cx="30" cy="30" r="27"></circle><circle className="front" cx="30" cy="30" r="27"></circle></svg>
      <svg className="circle-inner" viewBox="0 0 34 34"><circle className="back" cx="17" cy="17" r="14"></circle><circle className="front" cx="17" cy="17" r="14"></circle></svg>
      <div className="text" data-text="Authenticating..."></div>
    </div>
  </div>
);

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If Firebase is done loading, there is no user, and they aren't on the login page -> Kick them to login
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // 1. If we are on the login page, render normally so they can log in
  if (pathname === '/login') {
    return children;
  }

  // 2. If Firebase is still verifying the user, show the loader.
  // This physically blocks the page layout from rendering.
  if (loading) {
    return <AuthLoader />;
  }

  // 3. If there is no user, render nothing (the useEffect will redirect them instantly)
  if (!user) {
    return null;
  }

  // 4. User is authenticated, safe to render the app!
  return children;
} 