import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthCallback from './pages/OAuthCallback';
import PublicForm from './pages/PublicForm';
import PublicTicketView from './pages/PublicTicketView';
import TicketList from './pages/TicketList';
import TicketView from './pages/TicketView';
import TicketNew from './pages/TicketNew';
import MojeTickety from './pages/MojeTickety';
import Odlozone from './pages/Odlozone';
import Kalendarz from './pages/Kalendarz';
import Statystyki from './pages/Statystyki';
import Uzytkownicy from './pages/Uzytkownicy';
import Szablony from './pages/Szablony';
import Zespoly from './pages/Zespoly';
import Ustawienia from './pages/Ustawienia';
import Spam from './pages/Spam';
import Pomoc from './pages/Pomoc';
import CsatSurvey from './pages/CsatSurvey';
import ChatWidget from './pages/ChatWidget';
import KanalyCzatu from './pages/KanalyCzatu';
import Czaty from './pages/Czaty';
import ChatTicketView from './pages/ChatTicketView';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.rola === 'admin' ? '/tickets' : '/moje'} /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/zgloszenie" element={<PublicForm />} />
      <Route path="/status/:token" element={<PublicTicketView />} />
      <Route path="/ocena/:token" element={<CsatSurvey />} />
      <Route path="/chat/:channelKey" element={<ChatWidget />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Navigate to={user?.rola === 'admin' ? '/tickets' : '/moje'} />
        </ProtectedRoute>
      } />

      <Route path="/tickets" element={
        <ProtectedRoute adminOnly>
          <Layout><TicketList title="Wszystkie tickety" /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/tickets/nowy" element={
        <ProtectedRoute adminOnly>
          <Layout><TicketNew /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/tickets/:id" element={
        <ProtectedRoute>
          <Layout><TicketView /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/moje" element={
        <ProtectedRoute>
          <Layout><MojeTickety /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/czaty" element={
        <ProtectedRoute>
          <Layout><Czaty /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/czaty/:id" element={
        <ProtectedRoute>
          <Layout><ChatTicketView /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/odlozone" element={
        <ProtectedRoute>
          <Layout><Odlozone /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/kalendarz" element={
        <ProtectedRoute>
          <Layout><Kalendarz /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/statystyki" element={
        <ProtectedRoute adminOnly>
          <Layout><Statystyki /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/uzytkownicy" element={
        <ProtectedRoute adminOnly>
          <Layout><Uzytkownicy /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/szablony" element={
        <ProtectedRoute adminOnly>
          <Layout><Szablony /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/zespoly" element={
        <ProtectedRoute adminOnly>
          <Layout><Zespoly /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/kanaly-czatu" element={
        <ProtectedRoute adminOnly>
          <Layout><KanalyCzatu /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/ustawienia" element={
        <ProtectedRoute adminOnly>
          <Layout><Ustawienia /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/spam" element={
        <ProtectedRoute adminOnly>
          <Layout><Spam /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/pomoc" element={
        <ProtectedRoute>
          <Layout><Pomoc /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
