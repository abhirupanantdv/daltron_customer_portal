import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import ChatPage from "@/components/ChatPage";
import DocumentTitle from "@/components/DocumentTitle";
import LoadingScreen from "@/components/LoadingScreen";
import LoginPage from "@/components/LoginPage";
import NewTicketForm from "@/components/NewTicketForm";
import Overview from "@/components/Overview";
import PageTransition from "@/components/PageTransition";
import TicketDetail from "@/components/TicketDetail";
import TicketList from "@/components/TicketList";
import TicketsProvider from "@/components/TicketsProvider";
import { safeReturnPath } from "@/lib/auth";

function LoginRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <LoadingScreen />;
  if (status === "in") {
    const next = safeReturnPath(new URLSearchParams(location.search).get("redirect-to"));
    return <Navigate to={next} replace />;
  }
  return <LoginPage />;
}

function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <LoadingScreen />;
  if (status !== "in") {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect-to=${encodeURIComponent(next)}`} replace />;
  }
  return (
    <TicketsProvider>
      <AppShell>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </AppShell>
    </TicketsProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route
          path="/"
          element={
            <>
              <DocumentTitle title="AnantDV Support" />
              <Overview />
            </>
          }
        />
        <Route
          path="/tickets"
          element={
            <>
              <DocumentTitle title="Tickets — AnantDV" />
              <TicketList />
            </>
          }
        />
        <Route
          path="/tickets/new"
          element={
            <>
              <DocumentTitle title="New ticket — AnantDV" />
              <NewTicketForm />
            </>
          }
        />
        <Route
          path="/tickets/:id"
          element={
            <>
              <DocumentTitle title="Ticket — AnantDV" />
              <TicketDetail />
            </>
          }
        />
        <Route
          path="/tickets/:id/chat"
          element={
            <>
              <DocumentTitle title="Chat — AnantDV" />
              <ChatPage />
            </>
          }
        />
      </Route>
    </Routes>
  );
}
