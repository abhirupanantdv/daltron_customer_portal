import { Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ChatPage from "@/components/ChatPage";
import DocumentTitle from "@/components/DocumentTitle";
import NewTicketForm from "@/components/NewTicketForm";
import Overview from "@/components/Overview";
import PageTransition from "@/components/PageTransition";
import TicketDetail from "@/components/TicketDetail";
import TicketList from "@/components/TicketList";
import TicketsProvider from "@/components/TicketsProvider";

export default function App() {
  return (
    <TicketsProvider>
      <AppShell>
        <PageTransition>
          <Routes>
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
          </Routes>
        </PageTransition>
      </AppShell>
    </TicketsProvider>
  );
}
