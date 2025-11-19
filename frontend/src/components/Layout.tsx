import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">WPC</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">WoW Price Checker</h1>
                <p className="text-xs text-gray-400">Classic Anniversary</p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="flex space-x-1">
              <NavLink to="/" active={isActive('/')}>
                Home
              </NavLink>
              <NavLink to="/search" active={isActive('/search')}>
                Search
              </NavLink>
              <NavLink to="/settings" active={isActive('/settings')}>
                Settings
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <p>
              WoW Price Checker - Alternative to TSM with better price accuracy
            </p>
            <div className="flex space-x-4">
              <a
                href="https://github.com/Babilounet/wow-price-checker"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                GitHub
              </a>
              <a
                href="/api/v1/health"
                target="_blank"
                className="hover:text-green-400 transition-colors"
              >
                API Status
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

function NavLink({ to, active, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}
