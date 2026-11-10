import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NavBar from './NavBar';
import Footer from './Footer';

// Fixed ambient glow behind every page: two soft blue/violet orbs and a faint grid.
function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(14_22_48)_0%,var(--color-void)_60%)]" />
      <div className="absolute -top-40 left-[-10%] h-[38rem] w-[38rem] rounded-full bg-electric/20 blur-[140px]" />
      <div className="absolute top-[30%] right-[-15%] h-[34rem] w-[34rem] rounded-full bg-violet/20 blur-[150px]" />
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Aurora />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-electric focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <NavBar overlay={isLanding} />
      <motion.main
        id="main"
        key={location.pathname}
        className="flex-1"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  );
}
