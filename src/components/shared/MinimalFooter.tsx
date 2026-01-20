import { Link } from 'react-router-dom';
import { useStudioSettings } from '@/hooks/useStudioSettings';

interface MinimalFooterProps {
  className?: string;
}

/**
 * A minimal footer for admin and client portals.
 * Uses semantic tokens for consistent styling.
 */
export const MinimalFooter = ({ className = '' }: MinimalFooterProps) => {
  const { identity } = useStudioSettings();
  
  return (
    <footer className={`border-t border-border bg-card ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {identity.name}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MinimalFooter;
