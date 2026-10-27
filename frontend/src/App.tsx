import { Link, Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CompanionPage, PreferencesPage, ProfilePage, SettingsPage } from "@/pages/AccountPages";
import { ForgotPasswordPage, LoginPage, RegisterPage } from "@/pages/AuthForm";
import { ChatPage } from "@/pages/ChatPage";
import { ConversationsPage } from "@/pages/ConversationsPage";
import { FoodPage } from "@/pages/FoodPage";
import { GuidePage } from "@/pages/GuidePage";
import { HomePage } from "@/pages/HomePage";
import { JournalPage } from "@/pages/JournalPage";
import { LandingPage } from "@/pages/LandingPage";
import { OwnerFeedbackPage } from "@/pages/OwnerFeedbackPage";
import { PlannerPage } from "@/pages/PlannerPage";
import { AboutPage, FeedbackPage, PrivacyPage } from "@/pages/PublicPages";
import { FeedbackForm } from "@/pages/FeedbackForm";
import { RestaurantsPage } from "@/pages/RestaurantsPage";
import { PageHeader } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid h-dvh place-items-center text-sm text-soft">Opening SAHARA…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function AppFeedback() {
  useDocumentTitle("Feedback");
  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Feedback" title="Tell us what to fix" body="A rating and a short note are enough. Email is optional." />
      <FeedbackForm />
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div>
        <h1 className="font-serif text-5xl">That page is missing</h1>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent">Back home</Link>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/feedback", element: <FeedbackPage /> },
  { path: "/owner/feedback", element: <OwnerFeedbackPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot", element: <ForgotPasswordPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/app",
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "chat", element: <ChatPage /> },
      { path: "chat/:conversationId", element: <ChatPage /> },
      { path: "conversations", element: <ConversationsPage /> },
      { path: "food", element: <FoodPage /> },
      { path: "restaurants", element: <RestaurantsPage /> },
      { path: "study", element: <GuidePage kind="study" title="Help me study" body="Ask in ordinary language. SAHARA explains step by step." examples={["I want to learn programming.", "Explain this programming concept.", "Help me prepare for my exam.", "Teach me JavaScript from zero."]} notice="Study answers can be wrong. Check them against your course or a teacher." /> },
      { path: "plan", element: <PlannerPage /> },
      { path: "career", element: <GuidePage kind="career" title="Career help" body="Ask about skills, a CV, or an interview." examples={["How can I become a software engineer?", "Help me improve my CV.", "Prepare me for an interview.", "Which skill should I learn?"]} notice="Live job listings are not connected. SAHARA will not invent companies or openings." /> },
      { path: "journal", element: <JournalPage /> },
      { path: "preferences", element: <PreferencesPage /> },
      { path: "companion", element: <CompanionPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "feedback", element: <AppFeedback /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
