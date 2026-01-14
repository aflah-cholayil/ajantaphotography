import { Badge } from '@/components/ui/badge';

type AlbumStatus = 'pending' | 'ready';

interface AlbumStatusBadgeProps {
  status: AlbumStatus;
}

export const AlbumStatusBadge = ({ status }: AlbumStatusBadgeProps) => {
  const config = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    },
    ready: {
      label: 'Ready',
      className: 'bg-green-500/20 text-green-500 border-green-500/30',
    },
  };

  const { label, className } = config[status] || config.pending;

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
};
