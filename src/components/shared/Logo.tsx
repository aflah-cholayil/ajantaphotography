import { Link } from 'react-router-dom';
import logoImage from '@/assets/logo.png';

interface LogoProps {
  variant?: 'default' | 'small' | 'large';
  className?: string;
  linkTo?: string;
}

export const Logo = ({
  variant = 'default',
  className = '',
  linkTo = '/',
}: LogoProps) => {
  // Increased sizes for stronger branding (25-40% larger)
  const sizeClasses = {
    small: 'h-14 md:h-16',      // Mobile: 56px, Desktop: 64px
    default: 'h-16 md:h-20',    // Mobile: 64px, Desktop: 80px  
    large: 'h-20 md:h-24',      // Mobile: 80px, Desktop: 96px
  };

  const content = (
    <div className={`flex items-center ${className}`}>
      <img
        src={logoImage}
        alt="Ajanta Photography"
        className={`${sizeClasses[variant]} w-auto object-contain`}
      />
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
};
