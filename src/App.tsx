import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import HashtagPage from "./pages/HashtagPage";
import NotFound from "./pages/NotFound";
import SimpleApp from "./pages/SimpleApp";
import UpdatedApp from "./pages/UpdatedApp";
import ShhhhApp from "./pages/ShhhhApp";
import UserProfile from "./pages/UserProfile";
import Admin from "./pages/Admin";
import ShhhhcoinWallet from "./pages/ShhhhcoinWallet";
import ShhhhcoinShop from "./pages/ShhhhcoinShop";

const queryClient = new QueryClient();

const AppRouter = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/shhhh" element={<ShhhhApp />} />
              <Route path="/simple" element={<SimpleApp />} />
              <Route path="/updated" element={<UpdatedApp />} />
              <Route path="/user/:userId" element={<UserProfile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/hashtag/:hashtag" element={<HashtagPage />} />
              <Route path="/shhhhcoin-wallet" element={<ShhhhcoinWallet />} />
              <Route path="/shhhhcoin-shop" element={<ShhhhcoinShop />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default AppRouter;
