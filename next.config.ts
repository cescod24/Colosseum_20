import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin access to /_next/* dev resources (HMR,
  // chunked client JS) by default — when the foreman opens the app on a
  // phone via the laptop's LAN IP, the browser's Host header is the LAN
  // IP, not "localhost", so React fails to hydrate and onClick handlers
  // never wire up. The HTML-only role-picker still works; everything
  // client-side (BottomNavBar, AssistantSheet, kit tiles, cart) is dead.
  //
  // Allow common private-network ranges so any phone on the same WiFi
  // works without further config. Production builds ignore this flag.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.1.191",
    "192.168.1.*",
    "192.168.0.*",
    "10.0.0.*",
    "172.16.*.*",
  ],
};

export default nextConfig;
