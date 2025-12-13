import { Space_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "700"],
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata = {
  title: "MyGameList",
  description: "Track, rate, and curate every game you play.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceMono.variable} ${bebas.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
