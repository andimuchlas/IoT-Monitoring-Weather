import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AdminLayout } from "../components/layout/admin-layout";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Weather Station Monitoring Platform | PT Luwes Inovasi Mandiri",
  description: "Platform Admin Pemantauan Stasiun Cuaca IoT Multi-Sensor Terdistribusi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${jakartaSans.className} ${bodyFont.className} ${monoFont.className}`}
    >
      <body>
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
