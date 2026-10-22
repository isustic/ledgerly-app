import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { UpdateChecker } from "@/components/UpdateChecker";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    variable: "--font-ibm-mono",
    display: "swap",
    weight: ["400", "500"],
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
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Applies the saved theme before first paint to avoid a light flash in dark mode */}
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body className={`${inter.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased`}>
                <LanguageProvider>
                    <ThemeProvider>
                        <TooltipProvider>
                            <div className="flex h-screen overflow-hidden">
                                <Sidebar />
                                <main className="flex-1 overflow-auto">{children}</main>
                            </div>
                        </TooltipProvider>
                        <UpdateChecker />
                    </ThemeProvider>
                </LanguageProvider>
            </body>
        </html>
    );
}
