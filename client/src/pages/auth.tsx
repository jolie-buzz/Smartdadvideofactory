import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, LogIn, UserPlus, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registered, setRegistered] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ username, password });
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 4) {
      toast({
        title: "Password too short",
        description: "Password must be at least 4 characters.",
        variant: "destructive",
      });
      return;
    }
    try {
      await register.mutateAsync({ username, password });
      setRegistered(true);
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message || "Could not create account",
        variant: "destructive",
      });
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold" data-testid="text-pending-title">Account Pending Approval</h2>
              <p className="text-muted-foreground" data-testid="text-pending-message">
                Your account has been created and is pending admin approval.
                You'll be able to log in once an administrator approves your account.
              </p>
              <Button
                variant="outline"
                onClick={() => { setRegistered(false); setMode("login"); }}
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
              <Video className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl" data-testid="text-auth-title">SmartDad Video Factory</CardTitle>
          </div>
          <CardDescription data-testid="text-auth-description">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={login.isPending} data-testid="button-login">
                <LogIn className="w-4 h-4" />
                {login.isPending ? "Signing in..." : "Sign In"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => { setMode("register"); setUsername(""); setPassword(""); setConfirmPassword(""); }}
                  data-testid="link-register"
                >
                  Don't have an account? Register
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-username">Username</Label>
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  data-testid="input-reg-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-testid="input-reg-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-confirm">Confirm Password</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-testid="input-reg-confirm"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={register.isPending} data-testid="button-register">
                <UserPlus className="w-4 h-4" />
                {register.isPending ? "Creating account..." : "Create Account"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => { setMode("login"); setUsername(""); setPassword(""); setConfirmPassword(""); }}
                  data-testid="link-login"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
