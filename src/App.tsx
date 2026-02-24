import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UploadManagerProvider } from "@/contexts/UploadManagerContext";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import Gallery from "./pages/Gallery";
import Booking from "./pages/Booking";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminClients from "./pages/admin/Clients";
import AdminAlbums from "./pages/admin/Albums";
import AdminAlbumDetail from "./pages/admin/AlbumDetail";
import AdminBookings from "./pages/admin/Bookings";
import AdminMessages from "./pages/admin/Messages";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminWorks from "./pages/admin/Works";
import AdminSettings from "./pages/admin/Settings";
import AdminStorageDashboard from "./pages/admin/StorageDashboard";
import ServicesManagement from "./pages/admin/ServicesManagement";
import ClientDashboard from "./pages/client/Dashboard";
import ClientAlbumView from "./pages/client/AlbumView";
import ClientSettings from "./pages/client/Settings";
import SharedGallery from "./pages/share/SharedGallery";
import Questionnaire from "./pages/Questionnaire";
import AdminQuotations from "./pages/admin/Quotations";
import QuotationView from "./pages/QuotationView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UploadManagerProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            {/* Client Portal Routes */}
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/client/album/:id" element={<ClientAlbumView />} />
            <Route path="/client/settings" element={<ClientSettings />} />
            {/* Share Routes */}
            <Route path="/share/:token" element={<SharedGallery />} />
            {/* Questionnaire Route */}
            <Route path="/questionnaire/:token" element={<Questionnaire />} />
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/albums" element={<AdminAlbums />} />
            <Route path="/admin/albums/:id" element={<AdminAlbumDetail />} />
            <Route path="/admin/works" element={<AdminWorks />} />
            <Route path="/admin/bookings" element={<AdminBookings />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/storage" element={<AdminStorageDashboard />} />
            <Route path="/admin/services" element={<ServicesManagement />} />
            <Route path="/admin/quotations" element={<AdminQuotations />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            {/* Public Quotation View */}
            <Route path="/quotation/:quotationNumber" element={<QuotationView />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </UploadManagerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
