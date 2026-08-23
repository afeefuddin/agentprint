import { ImageResponse } from "next/og";

export const alt = "Agentprint — coding agent activity, made visible";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const cells = Array.from({ length: 84 }, (_, index) => {
    const level = (index * 17 + Math.floor(index / 7) * 11) % 5;
    return ["#e5e7e1", "#d8e3f7", "#aec2ea", "#7898db", "#456bc1"][level];
  });

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#f7f7f4", color: "#171914", padding: "72px 76px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "66%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "#171914", color: "#c8ff58", fontSize: 25 }}>A</div>
          Agentprint
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 73, lineHeight: 1.02, letterSpacing: -4, fontWeight: 600 }}>Your coding agent activity, made visible.</div>
          <div style={{ marginTop: 28, fontSize: 25, color: "#6f736b" }}>Private by default. Shared on your terms.</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: -40, top: 44, width: 420, height: 542, display: "flex", flexWrap: "wrap", alignContent: "center", gap: 10, padding: 32, border: "1px solid #d2d6cc", borderRadius: 34, background: "#fff", boxShadow: "0 30px 80px rgba(39,49,38,.12)", transform: "rotate(4deg)" }}>
        {cells.map((color, index) => <div key={index} style={{ width: 34, height: 34, borderRadius: 8, background: color }} />)}
      </div>
    </div>,
    size
  );
}
