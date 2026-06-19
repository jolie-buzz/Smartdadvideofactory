import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  ArrowLeft,
  UserPlus,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Trash2,
  Pencil,
  KeyRound,
  Shield,
  Users,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";

type AdminUser = {
  id: number;
  username: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");

  const [editUsername, setEditUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      toast({ title: "User created", description: "Account has been created and pre-approved." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update user", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete user", description: err.message, variant: "destructive" });
    },
  });

  const handleApprove = (u: AdminUser) => {
    updateUserMutation.mutate({ id: u.id, data: { status: "approved" } });
  };

  const handleRestrict = (u: AdminUser) => {
    updateUserMutation.mutate({ id: u.id, data: { status: "restricted" } });
  };

  const handleUnrestrict = (u: AdminUser) => {
    updateUserMutation.mutate({ id: u.id, data: { status: "approved" } });
  };

  const handleDelete = (u: AdminUser) => {
    if (confirm(`Delete user "${u.username}"? This cannot be undone.`)) {
      deleteUserMutation.mutate(u.id);
    }
  };

  const handleEditOpen = (u: AdminUser) => {
    setSelectedUser(u);
    setEditUsername(u.username);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!selectedUser || !editUsername.trim()) return;
    updateUserMutation.mutate(
      { id: selectedUser.id, data: { username: editUsername.trim() } },
    );
    setEditOpen(false);
    setSelectedUser(null);
  };

  const handleResetOpen = (u: AdminUser) => {
    setSelectedUser(u);
    setResetPassword("");
    setResetOpen(true);
  };

  const handleResetSave = () => {
    if (!selectedUser || !resetPassword.trim()) return;
    if (resetPassword.length < 4) {
      toast({ title: "Password too short", description: "Must be at least 4 characters.", variant: "destructive" });
      return;
    }
    updateUserMutation.mutate(
      { id: selectedUser.id, data: { password: resetPassword } },
    );
    setResetOpen(false);
    setSelectedUser(null);
    setResetPassword("");
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    if (newPassword.length < 4) {
      toast({ title: "Password too short", description: "Must be at least 4 characters.", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({ username: newUsername.trim(), password: newPassword, role: newRole });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" data-testid={`badge-status-approved`}>Approved</Badge>;
      case "pending":
        return <Badge variant="secondary" data-testid={`badge-status-pending`}>Pending</Badge>;
      case "restricted":
        return <Badge variant="destructive" data-testid={`badge-status-restricted`}>Restricted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const roleBadge = (role: string) => {
    if (role === "admin") {
      return <Badge variant="outline" data-testid={`badge-role-admin`}><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    }
    return <Badge variant="outline" data-testid={`badge-role-user`}>User</Badge>;
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
            <Video className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-admin-title">
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage users and accounts
            </p>
          </div>
          <Link href="/app">
            <Button variant="outline" className="gap-2" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium" data-testid="text-users-heading">
              Users ({users.length})
            </h2>
            {pendingCount > 0 && (
              <Badge variant="secondary" data-testid="badge-pending-count">
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-create-user">
            <UserPlus className="w-4 h-4" />
            Create User
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-users">
                No users found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium" data-testid={`text-username-${u.id}`}>
                        {u.username}
                      </TableCell>
                      <TableCell>{roleBadge(u.role)}</TableCell>
                      <TableCell>{statusBadge(u.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {u.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => handleApprove(u)}
                              disabled={updateUserMutation.isPending}
                              data-testid={`button-approve-${u.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </Button>
                          )}
                          {u.status === "approved" && u.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => handleRestrict(u)}
                              disabled={updateUserMutation.isPending}
                              data-testid={`button-restrict-${u.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                              Restrict
                            </Button>
                          )}
                          {u.status === "restricted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => handleUnrestrict(u)}
                              disabled={updateUserMutation.isPending}
                              data-testid={`button-unrestrict-${u.id}`}
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Unrestrict
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditOpen(u)}
                            data-testid={`button-edit-${u.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleResetOpen(u)}
                            data-testid={`button-reset-password-${u.id}`}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          {u.id !== user?.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(u)}
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-${u.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-username">Username</Label>
              <Input
                id="create-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                data-testid="input-create-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                data-testid="input-create-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-create">
                {createUserMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                data-testid="input-edit-username"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={updateUserMutation.isPending} data-testid="button-save-edit">
                {updateUserMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                data-testid="input-reset-password"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)} data-testid="button-cancel-reset">
                Cancel
              </Button>
              <Button onClick={handleResetSave} disabled={updateUserMutation.isPending} data-testid="button-save-reset">
                {updateUserMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
