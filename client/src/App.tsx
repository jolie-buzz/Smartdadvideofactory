import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
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
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
