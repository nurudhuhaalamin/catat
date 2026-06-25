import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./lib/auth";
import { BusinessProvider } from "./lib/businessContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import DebtsPage from "./pages/DebtsPage";
import ContactsPage from "./pages/ContactsPage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6 text-slate-500">{children}</div>;
}

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return <FullScreen>Memuat…</FullScreen>;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <BusinessProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BusinessProvider>
  );
}
