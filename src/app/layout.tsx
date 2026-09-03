import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ZoriaBooking — Reservas sencillas para tu negocio",
    template: "%s · ZoriaBooking",
  },
  description:
    "Sistema de reservas online para peluquerías, barberías, centros de estética, fisioterapia y más. Tus clientes reservan sin cuenta, tú lo gestionas todo desde un panel simple.",
};

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
