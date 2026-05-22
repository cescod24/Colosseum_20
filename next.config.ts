import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin access to /_next/* dev resources (HMR,
  // chunked client JS) by default — when the foreman opens the app on a
  // phone via the laptop's LAN IP, the browser's Host header is the LAN
  // IP, not "localhost", so React fails to hydrate and onClick handlers
  // never wire up. The HTML-only role-picker still works; everything
  // client-side (BottomNavBar, AssistantSheet, kit tiles, cart) is dead.
  //
  // Allow ALL private-network ranges so any phone on the same WiFi works
  // without knowing the exact subnet — the earlier list missed subnets like
  // 192.168.2.* or 10.1.*, which left hydration dead (buttons unresponsive)
  // on a phone hitting the laptop's LAN IP. Production builds ignore this.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
};

export default nextConfig;
