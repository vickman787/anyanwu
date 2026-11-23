import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anyanwu · Pay your whole team, in the light",
  description:
    "Anyanwu is stablecoin payroll on QIE. Fund a treasury, pay your whole team in one run, stream pay as work happens, and keep a public record of every payment.",
};

function SunMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-label="Anyanwu sun mark">
      <circle cx="17" cy="17" r="8" fill="#d97706" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI) / 6;
        const x1 = 17 + Math.cos(angle) * 11;
        const y1 = 17 + Math.sin(angle) * 11;
        const x2 = 17 + Math.cos(angle) * 15;
        const y2 = 17 + Math.sin(angle) * 15;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#92400e" strokeWidth="2" strokeLinecap="round" />;
      })}
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <nav className="nav">
            <a className="brand" href="/">
              <SunMark /> Anyanwu
            </a>
            <span className="spacer" />
            <a href="/dashboard">For employers</a>
            <a href="/portal">For workers</a>
          </nav>
          {children}
          <footer>
            Anyanwu — the Eye of the Sun. Stablecoin payroll on QIE.
            <br />
            Demo money only until the contracts are deployed on QIE mainnet. Nothing here moves real money yet.
          </footer>
        </div>
      </body>
    </html>
  );
}
