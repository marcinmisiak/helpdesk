import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false, kierownikOrAdmin = false }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.rola !== 'admin') return <Navigate to="/moje" replace />;
  if (kierownikOrAdmin && user.rola !== 'admin' && !(user.kierownik_zespol_ids?.length)) {
    return <Navigate to="/moje" replace />;
  }

  return children;
}
