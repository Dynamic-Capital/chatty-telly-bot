import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Users, Package, Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  telegram_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  features: string[];
}

interface PendingPayment {
  id: string;
  telegram_user_id: string;
  payment_method: string | null;
  created_at: string;
  receipt_telegram_file_id: string | null;
  subscription_plans?: { name?: string; price?: number } | null;
}

interface PackageAssignment {
  id: string;
  user_id: string;
  package_id: string;
  assigned_at: string;
  expires_at: string | null;
  is_active: boolean;
  telegram_added: boolean;
  telegram_channels: string[];
  notes: string | null;
}

export function UserManagement() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [packages, setPackages] = useState<SubscriptionPlan[]>([]);
  const [assignments, setAssignments] = useState<PackageAssignment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAssignPackageOpen, setIsAssignPackageOpen] = useState(false);

  const [newUser, setNewUser] = useState({
    telegram_id: '',
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'user'
  });

  const [packageAssignment, setPackageAssignment] = useState({
    user_id: '',
    package_id: '',
    expires_at: '',
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersResponse, packagesResponse, paymentsResponse] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('subscription_plans').select('*').order('name'),
        supabase.from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('payment_status', 'pending')
          .not('receipt_telegram_file_id', 'is', null)
          .order('created_at', { ascending: false })
      ]);

      if (usersResponse.error) throw usersResponse.error;
      if (packagesResponse.error) throw packagesResponse.error;

      setUsers(usersResponse.data || []);
      setPackages(packagesResponse.data || []);
      setPendingPayments(paymentsResponse.data || []);
      
      // Load assignments separately to handle the complex join
      const assignmentsResponse = await supabase
        .from('user_package_assignments')
        .select('*')
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });
        
      if (!assignmentsResponse.error) {
        setAssignments((assignmentsResponse.data as PackageAssignment[]) || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const addUser = () => {
    try {
      if (!newUser.first_name || !newUser.email) {
        toast({
          title: "Error",
          description: "First name and email are required",
          variant: "destructive",
        });
        return;
      }

      // For now, just show a message that manual user creation will be handled by admins
      toast({
        title: "Info",
        description: "Manual user creation feature will be implemented. Users should sign up through the auth system.",
        variant: "default",
      });

      setNewUser({
        telegram_id: '',
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'user'
      });
      setIsAddUserOpen(false);
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive",
      });
    }
  };

  const assignPackage = async () => {
    try {
      if (!packageAssignment.user_id || !packageAssignment.package_id) {
        toast({
          title: "Error",
          description: "Please select both user and package",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('user_package_assignments')
        .insert({
          user_id: packageAssignment.user_id,
          package_id: packageAssignment.package_id,
          expires_at: packageAssignment.expires_at || null,
          notes: packageAssignment.notes || null,
          is_active: true,
          telegram_added: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Package assigned successfully",
      });

      setPackageAssignment({
        user_id: '',
        package_id: '',
        expires_at: '',
        notes: ''
      });
      setIsAssignPackageOpen(false);
      loadData();
    } catch (error) {
      console.error('Error assigning package:', error);
      toast({
        title: "Error",
        description: "Failed to assign package",
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const revokePackage = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('user_package_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Package access revoked successfully",
      });

      loadData();
    } catch (error) {
      console.error('Error revoking package:', error);
      toast({
        title: "Error",
        description: "Failed to revoke package access",
        variant: "destructive",
      });
    }
  };

  const handlePaymentApproval = async (subscriptionId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          payment_status: approve ? 'approved' : 'rejected',
          is_active: approve,
          subscription_start_date: approve ? new Date().toISOString() : null,
          subscription_end_date: approve ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
        })
        .eq('id', subscriptionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Payment ${approve ? 'approved' : 'rejected'} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          You don't have permission to access user management.
        </AlertDescription>
      </Alert>
    );
  }

  const filteredUsers = users.filter(user =>
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.telegram_id?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={newUser.first_name}
                      onChange={(e) => setNewUser(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={newUser.last_name}
                      onChange={(e) => setNewUser(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="telegram_id">Telegram ID</Label>
                  <Input
                    id="telegram_id"
                    value={newUser.telegram_id}
                    onChange={(e) => setNewUser(prev => ({ ...prev, telegram_id: e.target.value }))}
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newUser.username}
                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="@johndoe"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addUser} className="w-full">
                  Add User
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAssignPackageOpen} onOpenChange={setIsAssignPackageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Assign Package
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Package to User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user_select">Select User</Label>
                  <Select value={packageAssignment.user_id} onValueChange={(value) => setPackageAssignment(prev => ({ ...prev, user_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="package_select">Select Package</Label>
                  <Select value={packageAssignment.package_id} onValueChange={(value) => setPackageAssignment(prev => ({ ...prev, package_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a package" />
                    </SelectTrigger>
                    <SelectContent>
                      {packages.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.name} - ${pkg.price} ({pkg.duration_months} months)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expires_at">Expiry Date (Optional)</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={packageAssignment.expires_at}
                    onChange={(e) => setPackageAssignment(prev => ({ ...prev, expires_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={packageAssignment.notes}
                    onChange={(e) => setPackageAssignment(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes about this assignment..."
                  />
                </div>
                <Button onClick={assignPackage} className="w-full">
                  Assign Package
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Users Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="w-full">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users ({filteredUsers.length})
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Package Assignments ({assignments.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pending Payments ({pendingPayments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telegram</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {user.first_name} {user.last_name}
                            </div>
                            {user.display_name && (
                              <div className="text-sm text-muted-foreground">
                                {user.display_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div>
                            {user.telegram_id && (
                              <div className="text-sm">{user.telegram_id}</div>
                            )}
                            {user.username && (
                              <div className="text-sm text-muted-foreground">
                                @{user.username}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'moderator' ? 'secondary' : 'outline'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'destructive'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="assignments">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Package ID</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-mono text-xs">
                          {assignment.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {assignment.user_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {assignment.package_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {new Date(assignment.assigned_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {assignment.expires_at 
                            ? new Date(assignment.expires_at).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.is_active ? 'default' : 'destructive'}>
                            {assignment.is_active ? 'Active' : 'Revoked'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {assignment.is_active && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokePackage(assignment.id)}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="payments">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">
                          {payment.telegram_user_id}
                        </TableCell>
                        <TableCell>
                          {payment.subscription_plans?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          ${payment.subscription_plans?.price || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payment.payment_method?.toUpperCase() || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {payment.receipt_telegram_file_id ? (
                            <Badge variant="default">✅ Uploaded</Badge>
                          ) : (
                            <Badge variant="destructive">❌ Missing</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handlePaymentApproval(payment.id, true)}
                            >
                              ✅ Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handlePaymentApproval(payment.id, false)}
                            >
                              ❌ Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}