import { ImageResponse } from "next/og";

export const alt =
  "Tender — Make APIs compete for your traffic. Simulated provider comparison.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "56px 64px",
        background: "#f8f9f7",
        color: "#19201d",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, letterSpacing: -1 }}>
        Tender
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 60 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 650 }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              letterSpacing: -4,
              lineHeight: 1.1,
            }}
          >
            Make APIs compete
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              letterSpacing: -4,
              lineHeight: 1.1,
            }}
          >
            for your traffic.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 330,
            border: "1px solid #dfe3dd",
            background: "#ffffff",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "20px",
              fontSize: 15,
              color: "#666d68",
            }}
          >
            Bitcoin price · Simulated market
          </div>
          {[
            { name: "Provider A", price: "$0.40", status: "Active" },
            { name: "Provider B", price: "$0.46", status: "Eligible" },
            { name: "Provider C", price: "$0.28", status: "Too slow" },
          ].map((provider, i) => (
            <div
              key={provider.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid #dfe3dd",
                background: i === 0 ? "#edf2ff" : "#ffffff",
                padding: "20px",
                fontSize: 15,
                color: i === 0 ? "#2859d7" : "#666d68",
              }}
            >
              <span>{provider.name}</span>
              <span>{provider.price}</span>
              <span>{provider.status}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              padding: "16px 20px",
              fontSize: 13,
              color: "#666d68",
            }}
          >
            Illustrative USD per 1K requests
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #dfe3dd",
          paddingTop: 22,
          color: "#666d68",
          fontSize: 17,
        }}
      >
        Compare API providers on price, speed, and data freshness.
      </div>
    </div>,
    size,
  );
}
