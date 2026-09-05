import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server only serves /_next/static/* and the HMR websocket to
  // the origin it detects as local, and treats "127.0.0.1" and "localhost"
  // as different origins for that check. Without this, opening the dev
  // server via 127.0.0.1 gets every JS chunk 403'd — the page's SSR HTML
  // still renders, but React never hydrates: no event handlers attach, no
  // effect ever runs, so anything that depends on the client bundle (nav
  // disclosures, the command palette, data fetched in useEffect) is
  // permanently dead. Dev-only; has no effect on a production build.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
