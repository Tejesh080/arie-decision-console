import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The link-preview card for Slack/X/LinkedIn. Same "Instrument" palette and
 * the same threshold-crossing mark as the app itself (`brand/Mark.tsx`) —
 * hardcoded hex here since Satori renders outside the app's CSS, with no
 * access to the custom properties in `globals.css`.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#08090b",
          backgroundImage:
            "radial-gradient(1100px 520px at 50% -18%, rgba(77,141,255,0.16), transparent 70%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h11" stroke="#7d8491" strokeWidth="1.75" strokeLinecap="round" />
            <path d="M15 4.5v15" stroke="#949aa6" strokeWidth="1.75" strokeLinecap="round" />
            <circle cx="19.5" cy="12" r="2.5" fill="#4d8dff" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: "#e9ebef", letterSpacing: -0.5 }}>
              ARIE
            </span>
            <span
              style={{
                fontSize: 15,
                color: "#7d8491",
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              Decision Console
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 64,
            fontSize: 56,
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: -1.5,
            color: "#e9ebef",
            maxWidth: 980,
          }}
        >
          Stop paying for lead data once you already know enough to decide.
        </div>

        <div style={{ marginTop: 32, fontSize: 22, color: "#949aa6", maxWidth: 820 }}>
          ARIE buys enrichment one provider at a time and stops as soon as more data
          couldn&apos;t change the answer.
        </div>
      </div>
    ),
    { ...size },
  );
}
