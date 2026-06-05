import { Switch, Route } from "wouter";
import { hydrateCachedApiQueries, queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AdminPage from "@/pages/admin";
import AuthPage from "@/pages/auth";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ShieldX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Component, type ErrorInfo, type ReactNode } from "react";

hydrateCachedApiQueries();

function AuthenticatedApp() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (user.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold" data-testid="text-pending-status">Account Pending Approval</h2>
              <p className="text-muted-foreground" data-testid="text-pending-description">
                Your account is awaiting admin approval. Please check back later.
              </p>
              <Button variant="outline" onClick={() => logout.mutate()} data-testid="button-pending-logout">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.status === "restricted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-destructive/10">
                <ShieldX className="w-6 h-6 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold" data-testid="text-restricted-status">Account Restricted</h2>
              <p className="text-muted-foreground" data-testid="text-restricted-description">
                Your account has been restricted. Please contact an administrator.
              </p>
              <Button variant="outline" onClick={() => logout.mutate()} data-testid="button-restricted-logout">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppErrorBoundary>
          <AuthenticatedApp />
        </AppErrorBoundary>
        <PwaInstallPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] Render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#070a0f] px-4 py-10 text-white">
        <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-[#101620] p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#ffc400]">Buzzly Studio</p>
          <h1 className="mt-2 text-xl font-semibold">Something crashed while loading Studio.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Please reload once. If this keeps happening, send the error below.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-red-200">
            {this.state.error.message}
          </pre>
          <Button className="mt-4 w-full" onClick={() => window.location.reload()}>
            Reload Studio
          </Button>
        </div>
      </div>
    );
  }
}

export default App;
