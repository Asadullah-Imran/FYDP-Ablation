import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { PopupProvider } from "@/context/PopupContext";
import Navigation from "@/components/Navigation";

export const metadata = {
  title: "SpatialAblate - Spatial Multi-Omics Leaderboard",
  description: "A centralized benchmark leaderboard platform to track and compare spatial bioinformatics and multi-omics integration models.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <PopupProvider>
                <div className="min-h-screen bg-background text-on-background flex flex-col transition-colors duration-300 font-inter">
                  <Navigation />
                  <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-8 py-8 overflow-auto">
                    {children}
                  </main>
                </div>
              </PopupProvider>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
