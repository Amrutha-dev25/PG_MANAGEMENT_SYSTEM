import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PG Manager - Accommodation Management System",
  description: "DBMS Level 3 project: PG accommodation management with MySQL and MongoDB.",
};
export const viewport: Viewport = { themeColor: "#5b5bd6", width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('pg-theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.dataset.theme=t||'light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
