import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  HardDrive, Upload, Download, IndianRupee, RefreshCw, AlertTriangle, Database, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

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

const fetchStorageStats = async (force: boolean): Promise<StorageStats> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-stats${force ? '?force=true' : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch storage stats');
  }

  return res.json();
};

const CHART_COLORS = [
  'hsl(42, 75%, 55%)',   // gold
  'hsl(42, 60%, 70%)',   // gold-light
  'hsl(200, 60%, 50%)',  // blue
  'hsl(150, 50%, 45%)',  // green
  'hsl(0, 62%, 50%)',    // red
];

const STORAGE_THRESHOLD_GB = 50;
const COST_THRESHOLD_INR = 5000;

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
    setTimeout(() => {
      refetch();
      setForceRefresh(false);
    }, 100);
  };

  const cacheAge = stats ? Math.round((Date.now() - stats.cachedAt) / 60000) : null;

  const costPieData = stats ? [
    { name: 'Storage', value: stats.costs.storageCostINR },
    { name: 'Transfer', value: stats.costs.transferCostINR },
  ].filter(d => d.value > 0) : [];

  if (costPieData.length === 0 && stats) {
    costPieData.push({ name: 'Storage', value: stats.costs.storageCostINR || 0.01 });
  }

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
              Real-time AWS S3 usage and cost analytics
              {cacheAge !== null && (
                <span className="ml-2 text-xs">
                  · Updated {cacheAge < 1 ? 'just now' : `${cacheAge}m ago`}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Alerts */}
        {stats && stats.summary.totalGB > STORAGE_THRESHOLD_GB * 0.8 && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10">
            <AlertTriangle size={20} className="text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Storage usage is at {stats.summary.totalGB.toFixed(1)} GB — approaching the {STORAGE_THRESHOLD_GB} GB threshold.
            </p>
          </div>
        )}
        {stats && stats.costs.estimatedMonthlyCostINR > COST_THRESHOLD_INR && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10">
            <AlertTriangle size={20} className="text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Estimated monthly cost ₹{stats.costs.estimatedMonthlyCostINR.toFixed(0)} exceeds ₹{COST_THRESHOLD_INR} threshold.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10">
            <AlertTriangle size={20} className="text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">Failed to load stats: {(error as Error).message}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<HardDrive size={20} />}
            label="Total Storage"
            value={stats ? `${stats.summary.totalGB.toFixed(2)} GB` : undefined}
            sub={stats ? `${stats.summary.totalObjects.toLocaleString()} files` : undefined}
            loading={isLoading}
          />
          <SummaryCard
            icon={<Upload size={20} />}
            label="This Month Uploads"
            value={stats ? `${stats.summary.thisMonthUploadGB.toFixed(2)} GB` : undefined}
            loading={isLoading}
          />
          <SummaryCard
            icon={<Download size={20} />}
            label="Est. Downloads"
            value={stats ? `${stats.summary.estimatedDownloadGB.toFixed(2)} GB` : undefined}
            sub={stats ? `${stats.summary.totalDownloadCount.toLocaleString()} downloads` : undefined}
            loading={isLoading}
          />
          <SummaryCard
            icon={<IndianRupee size={20} />}
            label="Est. Monthly Cost"
            value={stats ? `₹${stats.costs.estimatedMonthlyCostINR.toFixed(2)}` : undefined}
            loading={isLoading}
            highlight
          />
        </div>

        {/* Charts */}
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
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(30, 10%, 12%)',
                        border: '1px solid hsl(35, 15%, 20%)',
                        borderRadius: '8px',
                        color: 'hsl(40, 30%, 95%)',
                      }}
                      formatter={(value: number) => [`${value.toFixed(3)} GB`, 'Uploaded']}
                    />
                    <Bar dataKey="sizeGB" fill="hsl(42, 75%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-sans font-medium flex items-center gap-2">
                <IndianRupee size={16} className="text-primary" />
                Cost Breakdown
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
                      {costPieData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      wrapperStyle={{ color: 'hsl(35, 15%, 55%)', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(30, 10%, 12%)',
                        border: '1px solid hsl(35, 15%, 20%)',
                        borderRadius: '8px',
                        color: 'hsl(40, 30%, 95%)',
                      }}
                      formatter={(value: number) => [`₹${value.toFixed(2)}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Per-Client Table */}
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
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
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
                        {c.storageGB < 1
                          ? `${(c.storageBytes / (1024 * 1024)).toFixed(1)} MB`
                          : `${c.storageGB.toFixed(2)} GB`}
                      </TableCell>
                      <TableCell className="text-right">{c.downloads}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ₹{c.estimatedCostINR.toFixed(2)}
                      </TableCell>
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

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  loading?: boolean;
  highlight?: boolean;
}

const SummaryCard = ({ icon, label, value, sub, loading, highlight }: SummaryCardProps) => (
  <Card className={highlight ? 'border-primary/30' : ''}>
    <CardContent className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {icon}
        </div>
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

export default StorageDashboard;
