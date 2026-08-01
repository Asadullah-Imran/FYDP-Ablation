export default function Skeleton({ className = '', variant = 'rectangular' }) {
  const baseClasses = 'animate-pulse bg-outline-border/50 dark:bg-outline-border/30';
  
  const variants = {
    rectangular: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded-sm',
  };

  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`} />
  );
}
