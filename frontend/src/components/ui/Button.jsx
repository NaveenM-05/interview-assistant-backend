import { Link } from 'react-router-dom';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition duration-300 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none';

const variants = {
  primary:
    'bg-electric-gradient text-white shadow-[0_8px_30px_-8px_rgb(59_130_246_/_0.7)] ' +
    'hover:shadow-[0_10px_40px_-6px_rgb(124_58_237_/_0.75)] hover:brightness-110 active:translate-y-px',
  glass:
    'glass glass-hover !rounded-xl text-ink hover:text-white active:translate-y-px',
  ghost: 'text-soft hover:text-white hover:bg-white/5',
  success:
    'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_8px_30px_-10px_rgb(52_211_153_/_0.7)] hover:brightness-110 active:translate-y-px',
  danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/40 hover:bg-rose-500/25',
};

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
};

export default function Button({ to, variant = 'primary', size = 'md', className = '', children, ...props }) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}
