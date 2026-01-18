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
  // Increased sizes for better visibility
  const sizeClasses = {
    small: 'h-10 md:h-12',
    default: 'h-12 md:h-14',
    large: 'h-16 md:h-20',
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
