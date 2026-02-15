import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  HardDrive, Upload, IndianRupee, RefreshCw, AlertTriangle, Database,
  BarChart3, Cloud, CheckCircle2, TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = {
  r2: 'hsl(210, 70%, 55%)',
  gold: 'hsl(42, 75%, 55%)',
  green: 'hsl(150, 50%, 45%)',
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

  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['storage-stats', forceRefresh],
    queryFn: () => fetchStorageStats(forceRefresh),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const handleRefresh = () => {
    setForceRefresh(true);
    setTimeout(() => { refetch(); setForceRefresh(false); }, 100);
  };

  const cacheAge = stats ? Math.round((Date.now() - stats.cachedAt) / 60000) : null;

  const r2 = stats?.providerBreakdown?.r2 ?? { totalBytes: 0, totalGB: 0, totalObjects: 0, costINR: 0 };

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
              Cloudflare R2 — usage &amp; costs
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

        {/* ─── Summary Cards ─────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ProviderCard
            icon={<HardDrive size={20} />}
            label="Total Storage"
            value={stats ? `${stats.summary.totalGB.toFixed(2)} GB` : undefined}
            sub={stats ? `${stats.summary.totalObjects.toLocaleString()} files` : undefined}
            loading={isLoading}
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
            sub="R2: Free egress, ₹1.2/GB after 10GB"
            loading={isLoading}
            highlight
          />
        </div>

        {/* Migration Complete Banner */}
        <Card className="border-[hsl(150,50%,45%)]/25">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(150,50%,45%)]/15 text-[hsl(150,50%,45%)]">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="font-medium text-foreground">Migration Complete</p>
                <p className="text-sm text-muted-foreground">All files are stored on Cloudflare R2. AWS S3 has been fully decommissioned.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Storage Growth Chart ───────────────────────────────────── */}
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

        {/* ─── Per-Client Table ──────────────────────────────── */}
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
  accent?: 'r2';
}

const ProviderCard = ({ icon, label, value, sub, loading, highlight, accent }: ProviderCardProps) => {
  const borderClass = accent === 'r2'
    ? 'border-[hsl(210,70%,55%)]/25'
    : highlight
      ? 'border-primary/30'
      : '';

  const iconBgClass = accent === 'r2'
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
