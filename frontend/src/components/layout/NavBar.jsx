import { LayoutDashboard, Menu, Mic, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Button from '../ui/Button';
import Logo from './Logo';

const links = [
  { to: '/setup', label: 'Mock interview', icon: Mic },
  { to: '/dashboard', label: 'Feedback dashboard', icon: LayoutDashboard },
];

export default function NavBar({ overlay = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || !overlay || open;
  const isInterviewArea = location.pathname.startsWith('/interview');

  return (
    <header
      className={`${overlay ? 'fixed' : 'sticky'} inset-x-0 top-0 z-40 transition duration-300 ${
        solid ? 'border-b border-line bg-void/70 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="rounded-lg" aria-label="AI Interview Assistant home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  isActive || (to === '/setup' && isInterviewArea)
                    ? 'bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgb(96_165_250_/_0.3)]'
                    : 'text-soft hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button to="/setup" size="sm">
            Start interview
          </Button>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg text-soft hover:bg-white/5 hover:text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line px-4 pb-4 pt-2 md:hidden">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${
                  isActive ? 'bg-white/[0.07] text-white' : 'text-soft'
                }`
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
