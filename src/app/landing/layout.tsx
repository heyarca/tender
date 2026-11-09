import { Geist } from "next/font/google";
import "@/components/landing/landing.css";
import { landingStyles as styles } from "@/components/landing/styles";

const display = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-landing-display",
});

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${styles.site} ${display.variable}`}>{children}</div>;
}
