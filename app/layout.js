import { Inter } from "next/font/google";
import "./globals.css";

const interBody = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const interDisplay = Inter({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

export const metadata = {
  title: "MyGameList",
  description: "Track, rate, and curate every game you play.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${interBody.variable} ${interDisplay.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
