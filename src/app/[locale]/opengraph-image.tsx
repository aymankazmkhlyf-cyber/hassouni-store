import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hassouni Digital Services";

/** Link preview card for WhatsApp, Instagram, Telegram and Facebook shares. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg,#5a3ff0 0%,#3b28b0 50%,#0f9f8f 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 800 }}>H</div>
          <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.9 }}>Hassouni Digital Services</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 40, lineHeight: 1.1 }}>Followers · Game top-ups · Subscriptions · Design</div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.85 }}>Iraq · Zain Cash · AsiaCell · Qi Card · Live support</div>
      </div>
    ),
    size,
  );
}
