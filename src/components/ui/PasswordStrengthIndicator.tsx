import { useMemo } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { validatePassword } from '@/lib/passwordValidation';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export const PasswordStrengthIndicator = ({
  password,
  showRequirements = true,
  className,
}: PasswordStrengthIndicatorProps) => {
  const validation = useMemo(() => validatePassword(password), [password]);

  if (!password) return null;

  const specialCharacters = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?";

  const requirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
    { met: [...password].some((ch) => specialCharacters.includes(ch)), text: 'One special character (recommended)' },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength:</span>
          <span className={cn(
            'font-medium capitalize',
            validation.strength.label === 'weak' && 'text-destructive',
            validation.strength.label === 'fair' && 'text-orange-500',
            validation.strength.label === 'good' && 'text-yellow-500',
            validation.strength.label === 'strong' && 'text-green-500',
          )}>
            {validation.strength.label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', validation.strength.color)}
            style={{ width: `${validation.strength.score}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="space-y-1.5">
          {requirements.map((req, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2 text-xs transition-colors',
                req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              )}
            >
              {req.met ? (
                <Check size={12} className="flex-shrink-0" />
              ) : (
                <X size={12} className="flex-shrink-0 text-muted-foreground/50" />
              )}
              <span>{req.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warning for weak passwords */}
      {validation.errors.length > 0 && validation.strength.score < 50 && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md text-xs text-destructive">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            {validation.errors.slice(0, 2).map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
