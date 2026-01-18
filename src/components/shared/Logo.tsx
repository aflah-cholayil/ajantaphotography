import { Link } from 'react-router-dom';
import logoImage from '@/assets/logo.png';

interface LogoProps {
  variant?: 'default' | 'small' | 'large';
  subtitle?: string;
  showSubtitle?: boolean;
  className?: string;
  linkTo?: string;
}

export const Logo = ({
  variant = 'default',
  subtitle = 'Photography',
  showSubtitle = true,
  className = '',
  linkTo = '/',
}: LogoProps) => {
  const sizeClasses = {
    small: 'h-8',
    default: 'h-10 md:h-12',
    large: 'h-14 md:h-16',
  };

  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoImage}
        alt="Ajanta Photography"
        className={`${sizeClasses[variant]} w-auto object-contain`}
      />
      {showSubtitle && (
        <div className="flex flex-col">
          <span className="font-serif text-lg md:text-xl font-light tracking-wider text-foreground leading-tight">
            Ajanta
          </span>
          <span className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-primary font-sans font-medium leading-tight">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
};
