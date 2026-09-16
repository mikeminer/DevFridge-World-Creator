import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevFridge World Creator",
  description:
    "Discord pipeline for meme communities to submit playable assets to the next season of DevFridge World.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
