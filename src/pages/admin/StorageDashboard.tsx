import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  HardDrive, Upload, IndianRupee, RefreshCw, AlertTriangle, Database,
  BarChart3, Cloud, Server, ArrowRightLeft, Loader2, CheckCircle2, XCircle, TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderBreakdown {
  totalBytes: number;
  totalGB: number;
  totalObjects: number;
  costINR: number;
}

interface StorageStats {
  summary: {
    totalBytes: number;
    totalGB: number;
    totalObjects: number;
    thisMonthUploadBytes: number;
    thisMonthUploadGB: number;
    estimatedDownloadGB: number;
    totalDownloadCount: number;
  };
  costs: {
    storageCostINR: number;
    transferCostINR: number;
    estimatedMonthlyCostINR: number;
  };
  providerBreakdown?: {
    aws: ProviderBreakdown;
    r2: ProviderBreakdown;
  };
  prefixSizes: Record<string, number>;
  monthlyGrowth: { month: string; sizeGB: number }[];
  clientBreakdown: {
    clientId: string;
    clientName: string;
    albumCount: number;
    storageBytes: number;
    storageGB: number;
    downloads: number;
    estimatedCostINR: number;
  }[];
  cachedAt: number;
}

interface MigrationCounts {
  media: { aws: number; r2: number };
  works: { aws: number; r2: number };
  totalRemaining: number;
}

interface MigrationResult {
  migrated: number;
  failed: number;
  errors: string[];
  message: string;
}

type MigrationStatus = 'idle' | 'running' | 'done' | 'error';

// ─── API helpers ────────────────────────────────────────────────────────────

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
};

const fetchStorageStats = async (force: boolean): Promise<StorageStats> => {
  const headers = await getAuthHeaders();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-stats${force ? '?force=true' : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch storage stats');
  }
  return res.json();
};

const fetchMigrationStatus = async (): Promise<MigrationCounts> => {
  const headers = await getAuthHeaders();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-to-r2`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'status' }) });
  if (!res.ok) throw new Error('Failed to fetch migration status');
  return res.json();
};

const startMigrationBatch = async (): Promise<MigrationResult> => {
  const headers = await getAuthHeaders();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate-to-r2`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'start' }) });
  if (!res.ok) throw new Error('Failed to start migration batch');
  return res.json();
};

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = {
  aws: 'hsl(30, 80%, 55%)',     // amber/orange
  r2: 'hsl(210, 70%, 55%)',     // blue
  gold: 'hsl(42, 75%, 55%)',
  green: 'hsl(150, 50%, 45%)',
  red: 'hsl(0, 62%, 50%)',
};

const TOOLTIP_STYLE = {
  background: 'hsl(30, 10%, 12%)',
  border: '1px solid hsl(35, 15%, 20%)',
  borderRadius: '8px',
  color: 'hsl(40, 30%, 95%)',
};

// ─── Component ──────────────────────────────────────────────────────────────

const StorageDashboard = () => {
  const [forceRefresh, setForceRefresh] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
  const [migrationCounts, setMigrationCounts] = useState<MigrationCounts | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['storage-stats', forceRefresh],
    queryFn: () => fetchStorageStats(forceRefresh),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const loadMigrationStatus = useCallback(async () => {
    try {
      const counts = await fetchMigrationStatus();
      setMigrationCounts(counts);
    } catch (e) {
      console.error('Failed to load migration status:', e);
    }
  }, []);

  useEffect(() => {
    loadMigrationStatus();
  }, [loadMigrationStatus]);

  // Poll while running
  useEffect(() => {
    if (migrationStatus !== 'running') return;
    const id = setInterval(loadMigrationStatus, 5000);
    return () => clearInterval(id);
  }, [migrationStatus, loadMigrationStatus]);

  const handleRefresh = () => {
    setForceRefresh(true);
    setTimeout(() => { refetch(); setForceRefresh(false); }, 100);
    loadMigrationStatus();
  };

  const handleStartMigration = async () => {
    setMigrationStatus('running');
    setMigrationResult(null);
    try {
      const result = await startMigrationBatch();
      setMigrationResult(result);
      setMigrationStatus(result.failed > 0 && result.migrated === 0 ? 'error' : 'done');
      await loadMigrationStatus();
    } catch (e) {
      setMigrationStatus('error');
      setMigrationResult({ migrated: 0, failed: 0, errors: [(e as Error).message], message: 'Migration failed' });
    }
  };

  const cacheAge = stats ? Math.round((Date.now() - stats.cachedAt) / 60000) : null;

  // Provider data
  const aws = stats?.providerBreakdown?.aws ?? { totalBytes: 0, totalGB: 0, totalObjects: 0, costINR: 0 };
  const r2 = stats?.providerBreakdown?.r2 ?? { totalBytes: 0, totalGB: 0, totalObjects: 0, costINR: 0 };

  // Migration progress
  const totalFiles = migrationCounts
    ? migrationCounts.media.aws + migrationCounts.media.r2 + migrationCounts.works.aws + migrationCounts.works.r2
    : (aws.totalObjects + r2.totalObjects);
  const r2Files = migrationCounts
    ? migrationCounts.media.r2 + migrationCounts.works.r2
    : r2.totalObjects;
  const migrationPercent = totalFiles > 0 ? Math.round((r2Files / totalFiles) * 100) : 0;
  const awsRemaining = migrationCounts?.totalRemaining ?? (totalFiles - r2Files);

  // Cost comparison data
  const awsCostPerGB = 1.9;
  const r2CostPerGB = 1.2;
  const awsTransferPerGB = 7;
  const currentTotalGB = stats?.summary.totalGB ?? 0;
  const projectedR2Cost = Math.max(0, currentTotalGB - 10) * r2CostPerGB;
  const currentAWSCost = aws.costINR;
  const monthlySavings = currentAWSCost + (stats?.costs.transferCostINR ?? 0) - projectedR2Cost;

  // Pie chart: AWS vs R2 cost split
  const costPieData = [
    { name: 'AWS Storage', value: aws.costINR || 0.01 },
    { name: 'R2 Storage', value: r2.costINR || 0.01 },
  ].filter(d => d.value > 0);
  if (costPieData.length === 0) costPieData.push({ name: 'No Data', value: 0.01 });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-light tracking-wide text-foreground">
              Storage Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              AWS S3 &amp; Cloudflare R2 — usage, costs &amp; migration
              {cacheAge !== null && (
                <span className="ml-2 text-xs">· Updated {cacheAge < 1 ? 'just now' : `${cacheAge}m ago`}</span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10">
            <AlertTriangle size={20} className="text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">Failed to load stats: {(error as Error).message}</p>
          </div>
        )}

        {/* ─── Section A: Provider Breakdown Cards ─────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProviderCard
            icon={<HardDrive size={20} />}
            label="Total Storage"
            value={stats ? `${stats.summary.totalGB.toFixed(2)} GB` : undefined}
            sub={stats ? `${stats.summary.totalObjects.toLocaleString()} files` : undefined}
            loading={isLoading}
          />
          <ProviderCard
            icon={<Server size={20} />}
            label="AWS S3"
            value={stats ? `${aws.totalGB.toFixed(2)} GB` : undefined}
            sub={stats ? `${aws.totalObjects.toLocaleString()} files` : undefined}
            loading={isLoading}
            accent="aws"
          />
          <ProviderCard
            icon={<Cloud size={20} />}
            label="Cloudflare R2"
            value={stats ? `${r2.totalGB.toFixed(2)} GB` : undefined}
            sub={stats ? `${r2.totalObjects.toLocaleString()} files` : undefined}
            loading={isLoading}
            accent="r2"
          />
          <ProviderCard
            icon={<Upload size={20} />}
            label="This Month Uploads"
            value={stats ? `${stats.summary.thisMonthUploadGB.toFixed(2)} GB` : undefined}
            loading={isLoading}
          />
          <ProviderCard
            icon={<IndianRupee size={20} />}
            label="Est. Monthly Cost"
            value={stats ? `₹${stats.costs.estimatedMonthlyCostINR.toFixed(2)}` : undefined}
            loading={isLoading}
            highlight
          />
          <ProviderCard
            icon={<TrendingDown size={20} />}
            label="Potential Savings"
            value={stats ? `₹${Math.max(0, monthlySavings).toFixed(2)}/mo` : undefined}
            sub="If fully migrated to R2"
            loading={isLoading}
            accent="r2"
          />
        </div>

        {/* ─── Section B: Migration Control Panel ──────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-primary" />
              Storage Migration — AWS to R2
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {r2Files} of {totalFiles} files on R2
                  <span className="ml-1 text-xs">({awsRemaining} remaining on AWS)</span>
                </span>
                <span className="font-mono font-medium text-foreground">{migrationPercent}%</span>
              </div>
              <Progress value={migrationPercent} className="h-3" />
            </div>

            {/* Badges */}
            {migrationCounts && (
              <div className="flex flex-wrap gap-3 text-xs">
                <Badge variant="outline" className="gap-1.5 border-[hsl(30,80%,55%)]/40 text-[hsl(30,80%,55%)]">
                  <Server size={12} /> Media on AWS: {migrationCounts.media.aws}
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-[hsl(210,70%,55%)]/40 text-[hsl(210,70%,55%)]">
                  <Cloud size={12} /> Media on R2: {migrationCounts.media.r2}
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-[hsl(30,80%,55%)]/40 text-[hsl(30,80%,55%)]">
                  <Server size={12} /> Works on AWS: {migrationCounts.works.aws}
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-[hsl(210,70%,55%)]/40 text-[hsl(210,70%,55%)]">
                  <Cloud size={12} /> Works on R2: {migrationCounts.works.r2}
                </Badge>
              </div>
            )}

            {/* Migration result */}
            {migrationResult && (
              <div className={`p-3 rounded-lg border text-sm space-y-1 ${
                migrationResult.failed > 0
                  ? 'border-destructive/30 bg-destructive/10'
                  : 'border-[hsl(150,50%,45%)]/30 bg-[hsl(150,50%,45%)]/10'
              }`}>
                <div className="flex items-center gap-2">
                  {migrationResult.failed > 0
                    ? <XCircle size={14} className="text-destructive" />
                    : <CheckCircle2 size={14} className="text-[hsl(150,50%,45%)]" />
                  }
                  <span>{migrationResult.message}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Migrated: {migrationResult.migrated} · Failed: {migrationResult.failed}
                </p>
                {migrationResult.errors.length > 0 && (
                  <ul className="text-xs text-destructive mt-1 list-disc list-inside max-h-32 overflow-y-auto">
                    {migrationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {migrationStatus === 'running' ? (
                <Button disabled className="gap-2">
                  <Loader2 size={14} className="animate-spin" /> Running...
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="gap-2" disabled={awsRemaining === 0}>
                      <ArrowRightLeft size={14} />
                      {migrationResult ? 'Run Next Batch' : 'Start Migration'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Start Storage Migration</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>This will copy files from AWS S3 to Cloudflare R2 in batches of 20.</p>
                        <p className="font-medium text-foreground">⚠️ Important:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>Existing files on AWS will <strong>not</strong> be deleted</li>
                          <li>The database record will be updated to point to R2</li>
                          <li>Each batch processes up to 20 files</li>
                          <li>You can stop at any time between batches</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleStartMigration}>Start Migration</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {awsRemaining === 0 && (
                <Badge variant="secondary" className="gap-1.5 py-2 px-3">
                  <CheckCircle2 size={14} /> All files on R2
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Section C: Cost Comparison Table ────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
              <IndianRupee size={16} className="text-primary" />
              Cost Comparison — AWS vs R2
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      <Server size={12} className="text-[hsl(30,80%,55%)]" /> AWS S3
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      <Cloud size={12} className="text-[hsl(210,70%,55%)]" /> Cloudflare R2
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Storage cost / GB</TableCell>
                  <TableCell className="text-right font-mono text-sm">~₹{awsCostPerGB.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">~₹{r2CostPerGB.toFixed(1)} <span className="text-xs text-muted-foreground">(10 GB free)</span></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Egress / transfer cost</TableCell>
                  <TableCell className="text-right font-mono text-sm">~₹{awsTransferPerGB}/GB</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(150,50%,45%)]">Free</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Current monthly cost</TableCell>
                  <TableCell className="text-right font-mono text-sm">₹{(aws.costINR + (stats?.costs.transferCostINR ?? 0)).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">₹{r2.costINR.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Projected (fully on R2)</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-mono text-sm text-[hsl(150,50%,45%)]">₹{projectedR2Cost.toFixed(2)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2 border-primary/20">
                  <TableCell className="font-medium text-foreground">Est. Monthly Savings</TableCell>
                  <TableCell className="text-right" />
                  <TableCell className="text-right font-mono font-semibold text-[hsl(150,50%,45%)]">
                    ₹{Math.max(0, monthlySavings).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ─── Section D: Charts ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Storage Growth */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                Storage Growth (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : stats ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.monthlyGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 15%, 20%)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'hsl(35, 15%, 55%)', fontSize: 12 }}
                      tickFormatter={(v) => {
                        const [y, m] = v.split('-');
                        return new Date(+y, +m - 1).toLocaleString('default', { month: 'short' });
                      }}
                    />
                    <YAxis tick={{ fill: 'hsl(35, 15%, 55%)', fontSize: 12 }} unit=" GB" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`${value.toFixed(3)} GB`, 'Uploaded']} />
                    <Bar dataKey="sizeGB" fill={CHART_COLORS.gold} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Cost Breakdown Pie — AWS vs R2 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
                <IndianRupee size={16} className="text-primary" />
                Cost Split — AWS vs R2
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : stats ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={costPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ₹${value.toFixed(2)}`}
                    >
                      {costPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.name.includes('AWS') ? CHART_COLORS.aws : CHART_COLORS.r2} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ color: 'hsl(35, 15%, 55%)', fontSize: 12 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`₹${value.toFixed(2)}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* ─── Section E: Per-Client Table ──────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
              <Database size={16} className="text-primary" />
              Storage Per Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : stats && stats.clientBreakdown.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-center">Albums</TableHead>
                    <TableHead className="text-right">Storage</TableHead>
                    <TableHead className="text-right">Downloads</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.clientBreakdown.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="font-medium">{c.clientName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.albumCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {c.storageGB < 1 ? `${(c.storageBytes / (1024 * 1024)).toFixed(1)} MB` : `${c.storageGB.toFixed(2)} GB`}
                      </TableCell>
                      <TableCell className="text-right">{c.downloads}</TableCell>
                      <TableCell className="text-right font-mono text-sm">₹{c.estimatedCostINR.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No client data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

interface ProviderCardProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  loading?: boolean;
  highlight?: boolean;
  accent?: 'aws' | 'r2';
}

const ProviderCard = ({ icon, label, value, sub, loading, highlight, accent }: ProviderCardProps) => {
  const borderClass = accent === 'aws'
    ? 'border-[hsl(30,80%,55%)]/25'
    : accent === 'r2'
      ? 'border-[hsl(210,70%,55%)]/25'
      : highlight
        ? 'border-primary/30'
        : '';

  const iconBgClass = accent === 'aws'
    ? 'bg-[hsl(30,80%,55%)]/15 text-[hsl(30,80%,55%)]'
    : accent === 'r2'
      ? 'bg-[hsl(210,70%,55%)]/15 text-[hsl(210,70%,55%)]'
      : highlight
        ? 'bg-primary/20 text-primary'
        : 'bg-muted text-muted-foreground';

  return (
    <Card className={borderClass}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${iconBgClass}`}>{icon}</div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-2xl font-semibold font-sans text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageDashboard;
