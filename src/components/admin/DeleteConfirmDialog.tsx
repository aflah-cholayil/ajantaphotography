import { useState } from 'react';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteConfirmDialogProps {
  title: string;
  description: string;
  warningItems?: string[];
  confirmText?: string;
  entityName?: string;
  requireConfirmation?: boolean;
  isDeleting?: boolean;
  onConfirm: () => Promise<void>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteConfirmDialog({
  title,
  description,
  warningItems = [],
  confirmText = 'DELETE',
  entityName,
  requireConfirmation = true,
  isDeleting = false,
  onConfirm,
  trigger,
  open,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [localOpen, setLocalOpen] = useState(false);
  
  const isOpen = open !== undefined ? open : localOpen;
  const setIsOpen = onOpenChange || setLocalOpen;
  
  const isConfirmed = !requireConfirmation || confirmInput === confirmText;

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    await onConfirm();
    setConfirmInput('');
    setIsOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmInput('');
    }
    setIsOpen(newOpen);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>{description}</p>
            
            {entityName && (
              <div className="p-3 bg-muted rounded-lg border">
                <p className="text-sm text-muted-foreground">You are about to delete:</p>
                <p className="font-medium text-foreground">{entityName}</p>
              </div>
            )}
            
            {warningItems.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-destructive text-sm">This will permanently delete:</p>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {warningItems.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This action cannot be undone!
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {requireConfirmation && (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmText}
              className="font-mono"
              autoComplete="off"
            />
          </div>
        )}
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Permanently
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
