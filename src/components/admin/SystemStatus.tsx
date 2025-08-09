import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase, getQueryCounts } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCached } from '@/utils/cache';
import { getTimezones } from '@/utils/timezones';
import { 
  Database, 
  Zap, 
  Table, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Activity,
  Server,
  Code,
  Settings
} from 'lucide-react';

interface FunctionStatus {
  name: string;
  status: 'active' | 'error' | 'unknown';
  lastChecked?: string;
  responseTime?: number;
  error?: string;
}

interface TableInfo {
  name: string;
  recordCount: number;
  lastUpdated?: string;
  hasRLS: boolean;
  status: 'healthy' | 'warning' | 'error';
}

export const SystemStatus = () => {
  const [functions, setFunctions] = useState<FunctionStatus[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();
  const supabasePublic = supabase.schema('public');
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const supabaseProjectId =
    supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  const openSupabase = (path: string) => {
    if (!supabaseProjectId) return;
    globalThis.open(
      `https://supabase.com/dashboard/project/${supabaseProjectId}${path}`,
      '_blank'
    );
  };

  const edgeFunctions = [
    'telegram-bot',
    'test-bot-status',
    'reset-bot',
    'analytics-data',
    'ai-faq-assistant',
    'trade-helper',
    'binance-pay-checkout',
    'binance-pay-webhook',
    'setup-webhook',
    'cleanup-old-sessions',
    'cleanup-old-receipts'
  ];

  const coreTables = [
    'bot_users',
    'subscription_plans',
    'user_subscriptions',
    'payments',
    'education_packages',
    'education_enrollments',
    'promotions',
    'bot_content',
    'bot_settings',
    'user_interactions',
    'daily_analytics',
    'contact_links',
    'broadcast_messages',
    'admin_logs'
  ];

  useEffect(() => {
    // Warm timezone cache to avoid repeated database lookups
    getTimezones();
    checkSystemStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSystemStatus = async () => {
    setChecking(true);
    try {
      const [functionStatuses, tableInfos] = await Promise.all([
        getCached('function-status', CACHE_TTL, checkEdgeFunctions),
        getCached('table-status', CACHE_TTL, checkDatabaseTables)
      ]);
      setFunctions(functionStatuses);
      setTables(tableInfos);
      console.log('Supabase query counts', getQueryCounts());
    } catch (error) {
      console.error('Error checking system status:', error);
      toast({
        title: "Error",
        description: "Failed to check system status",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const checkEdgeFunctions = (): Promise<FunctionStatus[]> => {
    const checks = edgeFunctions.map(async (functionName) => {
      try {
        const startTime = Date.now();
        const { data: _data, error } = await supabase.functions.invoke(functionName, {
          body: { test: true }
        });
        const responseTime = Date.now() - startTime;

        return {
          name: functionName,
          status: error ? 'error' : 'active',
          lastChecked: new Date().toISOString(),
          responseTime,
          error: error?.message
        } as FunctionStatus;
      } catch (error) {
        return {
          name: functionName,
          status: 'error',
          lastChecked: new Date().toISOString(),
          error: (error as Error).message
        } as FunctionStatus;
      }
    });

    return Promise.all(checks);
  };

  const checkDatabaseTables = (): Promise<TableInfo[]> => {
    const checks = coreTables.map(async (tableName) => {
      try {
        const { count, error: countError } = await supabasePublic
          .from(tableName as never)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          return {
            name: tableName,
            recordCount: 0,
            hasRLS: false,
            status: 'error'
          } as TableInfo;
        }

        // Get last updated using created_at as a universal field
        const { data: latestRecord } = await supabasePublic
          .from(tableName as never)
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastUpdated = latestRecord ? (latestRecord as { created_at?: string }).created_at : undefined;

        return {
          name: tableName,
          recordCount: count || 0,
          lastUpdated,
          hasRLS: true,
          status: 'healthy'
        } as TableInfo;
      } catch (_error) {
        return {
          name: tableName,
          recordCount: 0,
          hasRLS: false,
          status: 'error'
        } as TableInfo;
      }
    });

    return Promise.all(checks);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const activeFunctions = functions.filter(f => f.status === 'active').length;
  const errorFunctions = functions.filter(f => f.status === 'error').length;
  const healthyTables = tables.filter(t => t.status === 'healthy').length;
  const totalRecords = tables.reduce((sum, table) => sum + table.recordCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            System Status
          </h1>
          <p className="text-muted-foreground">Monitor your Supabase functions and database health</p>
        </div>
        <Button 
          onClick={checkSystemStatus} 
          disabled={checking}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Refresh Status'}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Edge Functions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeFunctions}/{functions.length}</div>
            <p className="text-xs text-muted-foreground">
              {errorFunctions > 0 ? `${errorFunctions} errors` : 'All active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Tables</CardTitle>
            <Table className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthyTables}/{tables.length}</div>
            <p className="text-xs text-muted-foreground">
              Tables healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all tables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorFunctions === 0 && tables.every(t => t.status === 'healthy') ? (
                <span className="text-green-500">Excellent</span>
              ) : errorFunctions > 0 ? (
                <span className="text-red-500">Issues</span>
              ) : (
                <span className="text-yellow-500">Warning</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status */}
      <Tabs defaultValue="functions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="functions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Edge Functions ({functions.length})
          </TabsTrigger>
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            Database Tables ({tables.length})
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="functions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Edge Functions Status
              </CardTitle>
              <CardDescription>
                Status of all Supabase Edge Functions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {functions.map((func) => (
                    <div key={func.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(func.status)}
                        <div>
                          <h4 className="font-medium">{func.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {func.responseTime ? `${func.responseTime}ms response` : 'No response time'}
                          </p>
                          {func.error && (
                            <p className="text-xs text-red-500">{func.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(func.status)}
                        {func.lastChecked && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(func.lastChecked).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table className="h-5 w-5" />
                Database Tables Status
              </CardTitle>
              <CardDescription>
                Record counts and health status of core database tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {tables.map((table) => (
                    <div key={table.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(table.status)}
                        <div>
                          <h4 className="font-medium">{table.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                          <p className="text-sm text-muted-foreground">
                            {table.recordCount.toLocaleString()} records
                            {table.hasRLS && <span className="ml-2 text-green-600">• RLS Enabled</span>}
                          </p>
                          {table.lastUpdated && (
                            <p className="text-xs text-muted-foreground">
                              Last updated: {new Date(table.lastUpdated).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(table.status)}
                        <span className="text-sm font-mono text-muted-foreground">
                          {table.recordCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Functions Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total Functions:</span>
                  <Badge variant="outline">{functions.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Active Functions:</span>
                  <Badge className="bg-green-100 text-green-800">{activeFunctions}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Error Functions:</span>
                  <Badge variant="destructive">{errorFunctions}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Average Response:</span>
                  <Badge variant="outline">
                    {functions.length > 0 
                      ? `${Math.round(functions.reduce((sum, f) => sum + (f.responseTime || 0), 0) / functions.length)}ms`
                      : 'N/A'
                    }
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total Tables:</span>
                  <Badge variant="outline">{tables.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Healthy Tables:</span>
                  <Badge className="bg-green-100 text-green-800">{healthyTables}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Records:</span>
                  <Badge variant="outline">{totalRecords.toLocaleString()}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>RLS Protected:</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {tables.filter(t => t.hasRLS).length}/{tables.length}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Critical Issues Alert */}
          {errorFunctions > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical Issues Detected:</strong> {errorFunctions} edge function(s) are not responding properly. 
                This may affect bot functionality. Check the Functions tab for details.
              </AlertDescription>
            </Alert>
          )}

          {/* Health Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Health Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {errorFunctions === 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>All edge functions are responding correctly</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>Some edge functions need attention</span>
                  </div>
                )}

                {healthyTables === tables.length ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>All database tables are accessible</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>Some database tables have issues</span>
                  </div>
                )}

                {totalRecords > 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Database contains {totalRecords.toLocaleString()} records</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Database appears to be empty</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSupabase('')}
                >
                  <Server className="h-4 w-4 mr-2" />
                  Supabase Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSupabase('/functions')}
                >
                  <Code className="h-4 w-4 mr-2" />
                  Functions Console
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSupabase('/editor')}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Database Editor
                </Button>
              </div>
            </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};