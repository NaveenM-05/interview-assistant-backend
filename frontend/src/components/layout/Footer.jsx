import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-mute sm:flex-row sm:px-6">
        <Logo />
        <nav aria-label="Footer" className="flex gap-6">
          <Link to="/setup" className="hover:text-white">
            Mock interview
          </Link>
          <Link to="/dashboard" className="hover:text-white">
            Feedback dashboard
          </Link>
        </nav>
        <p>Real-time DSA and behavioral interview practice.</p>
      </div>
    </footer>
  );
}
