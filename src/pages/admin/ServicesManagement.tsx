import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ServiceFormDialog } from '@/components/admin/ServiceFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Edit, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
  Camera, Video, Heart, Star, Users, Clock, Briefcase, Image, Film,
  Award, Zap, Sun, Moon, Sparkles, Gift, Globe, MapPin, Aperture,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Camera, Video, Heart, Star, Users, Clock, Briefcase, Image, Film,
  Award, Zap, Sun, Moon, Sparkles, Gift, Globe, MapPin, Aperture,
};

const CATEGORY_LABELS: Record<string, string> = {
  wedding: 'Wedding', corporate: 'Corporate', fashion: 'Fashion',
  event: 'Event', portrait: 'Portrait', other: 'Other',
};

interface Service {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  full_description?: string | null;
  icon_name: string;
  category: string;
  price?: string | null;
  show_price: boolean;
  show_book_button: boolean;
  book_button_text: string;
  estimated_delivery?: string | null;
  is_active: boolean;
  display_order: number;
}

export default function ServicesManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchServices() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('services' as any)
      .select('*')
      .order('display_order');
    if (error) {
      toast.error('Failed to load services');
    } else {
      setServices((data as unknown as Service[]) || []);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchServices();
  }, []);

  function openCreate() {
    setEditingService(null);
    setFormOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setFormOpen(true);
  }

  async function handleToggleActive(service: Service) {
    const { error } = await supabase
      .from('services' as any)
      .update({ is_active: !service.is_active })
      .eq('id', service.id);
    if (error) {
      toast.error('Failed to update service status');
    } else {
      toast.success(`Service ${service.is_active ? 'deactivated' : 'activated'}`);
      fetchServices();
    }
  }

  async function handleMove(service: Service, direction: 'up' | 'down') {
    const sorted = [...services].sort((a, b) => a.display_order - b.display_order);
    const index = sorted.findIndex(s => s.id === service.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const target = sorted[targetIndex];
    const currentOrder = service.display_order;
    const targetOrder = target.display_order;

    await Promise.all([
      supabase.from('services' as any).update({ display_order: targetOrder }).eq('id', service.id),
      supabase.from('services' as any).update({ display_order: currentOrder }).eq('id', target.id),
    ]);
    fetchServices();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from('services' as any)
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error('Failed to delete service');
    } else {
      toast.success('Service deleted');
      setDeleteTarget(null);
      fetchServices();
    }
    setIsDeleting(false);
  }

  const sorted = [...services].sort((a, b) => a.display_order - b.display_order);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl lg:text-3xl text-foreground">Services Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage the services displayed on your public services page.
            </p>
          </div>
          <Button onClick={openCreate} className="btn-gold gap-2">
            <Plus size={16} />
            New Service
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Briefcase size={40} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl text-foreground mb-2">No services yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Create your first service to display on the public services page.</p>
            <Button onClick={openCreate} className="btn-gold gap-2">
              <Plus size={16} />
              Create First Service
            </Button>
          </div>
        )}

        {/* Services Grid */}
        {!isLoading && sorted.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((service, index) => {
              const IconComponent = ICON_MAP[service.icon_name] || Camera;
              return (
                <div
                  key={service.id}
                  className={`bg-card border rounded-lg p-5 flex flex-col gap-4 transition-all ${
                    service.is_active ? 'border-border' : 'border-border/50 opacity-60'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-serif text-base text-foreground truncate">{service.title}</h3>
                        <code className="text-xs text-muted-foreground">{service.slug}</code>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                      <Badge variant={service.is_active ? 'default' : 'secondary'} className="text-xs">
                        {service.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {CATEGORY_LABELS[service.category] || service.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2">{service.short_description}</p>

                  {/* Price / CTA info */}
                  <div className="text-xs text-muted-foreground">
                    {service.show_price && service.price && (
                      <span className="font-medium text-primary">{service.price}</span>
                    )}
                    {service.show_book_button && (
                      <span className="ml-2 text-foreground/70">
                        · Button: "{service.book_button_text}"
                      </span>
                    )}
                    {!service.show_price && !service.show_book_button && (
                      <span className="text-muted-foreground italic">Contact for Pricing</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border/50">
                    {/* Reorder */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMove(service, 'up')}
                      disabled={index === 0}
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMove(service, 'down')}
                      disabled={index === sorted.length - 1}
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </Button>

                    <div className="flex-1" />

                    {/* Toggle Active */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleActive(service)}
                      title={service.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {service.is_active
                        ? <ToggleRight size={16} className="text-primary" />
                        : <ToggleLeft size={16} className="text-muted-foreground" />
                      }
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(service)}
                      title="Edit"
                    >
                      <Edit size={14} />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(service)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        service={editingService}
        onSuccess={fetchServices}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Delete Service
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? 
              This will also delete all its feature points and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
