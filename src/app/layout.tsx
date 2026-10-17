import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Event & Activity Scheduling`,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="h-dvh max-h-dvh overflow-hidden antialiased font-sans"
        suppressHydrationWarning
      >
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
