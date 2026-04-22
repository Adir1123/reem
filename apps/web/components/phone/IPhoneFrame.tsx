import type { ReactNode } from "react";
import { SignalIcon, WifiIcon, BatteryIcon } from "./icons";

// iPhone 15 Pro logical dimensions (393x852pt). Bezel is the dark titanium
// rim around the screen. Forced LTR locally — the device chrome doesn't
// flip even when the surrounding page is RTL.
const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 9;
const RADIUS = 50;
const ISLAND_W = 126;
const ISLAND_H = 37;
const ISLAND_TOP = 11;
const STATUS_BAR_H = 54;
const HOME_INDICATOR_W = 134;

export function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      dir="ltr"
      style={{
        width: SCREEN_W + BEZEL * 2,
        height: SCREEN_H + BEZEL * 2,
        padding: BEZEL,
        background: "#1c1c1e",
        borderRadius: RADIUS + BEZEL,
        boxShadow:
          "0 30px 80px rgba(15,27,45,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.08)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          background: "#000",
          borderRadius: RADIUS,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: ISLAND_TOP,
            left: "50%",
            transform: "translateX(-50%)",
            width: ISLAND_W,
            height: ISLAND_H,
            background: "#000",
            borderRadius: ISLAND_H / 2,
            zIndex: 20,
          }}
        />

        {/* Status bar — sits behind the island, peeks out on the sides */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: STATUS_BAR_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            color: "#fff",
            fontSize: 17,
            fontWeight: 600,
            fontFamily:
              'system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif',
            zIndex: 10,
          }}
        >
          <span style={{ paddingTop: 18 }}>9:41</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingTop: 18,
            }}
          >
            <SignalIcon size={17} />
            <WifiIcon size={17} />
            <BatteryIcon size={26} />
          </div>
        </div>

        {/* App content area — starts below the status bar */}
        <div
          style={{
            position: "absolute",
            top: STATUS_BAR_H,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#fff",
            color: "#000",
            overflow: "hidden",
          }}
        >
          {children}
        </div>

        {/* Home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: HOME_INDICATOR_W,
            height: 5,
            background: "rgba(0,0,0,0.85)",
            borderRadius: 999,
            zIndex: 30,
          }}
        />
      </div>
    </div>
  );
}
