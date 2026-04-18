import { Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
/** Stitch secure login — Public Sans + MD3 tokens (`public/stitch-login.html`). Same project as marketing landing. */
import "./stitch.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-public-sans",
  display: "swap",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <div className={`${publicSans.className} min-h-screen`}>{children}</div>;
}
