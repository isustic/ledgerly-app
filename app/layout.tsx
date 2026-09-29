import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/theme-init";
import { Sidebar } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UpdateBanner } from "@/components/UpdateBanner";
import { UpdateChecker } from "@/components/UpdateChecker";

const cormorant = Cormorant_Garamond({
    subsets: ["latin"],
    variable: "--font-cormorant",
    display: "swap",
    weight: ["300", "400", "500", "600", "700"],
    style: ["normal", "italic"],
});

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
    display: "swap",
    weight: ["300", "400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    variable: "--font-ibm-mono",
    display: "swap",
    weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
    title: "Ledgerly",
    description: "Analyze and aggregate XLSX data with dynamic pivot reports",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${cormorant.variable} ${manrope.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased`}>
                <ThemeProvider>
                    <UpdateBanner currentVersion="1.1.2" />
                    <TooltipProvider>
                        <div className="flex h-screen overflow-hidden">
                            <Sidebar />
                            <main className="flex-1 overflow-auto">{children}</main>
                        </div>
                    </TooltipProvider>
                    <UpdateChecker />
                </ThemeProvider>
            </body>
        </html>
    );
}
