import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/case-files', label: 'Case Files' },
  { href: '/city-desk', label: 'City Desk' },
  { href: '/records-desk', label: 'Records Desk' },
  { href: '/crime-wire', label: 'Crime Wire' },
  { href: '/reader-desk', label: 'Reader Desk' },
  { href: '/standards', label: 'Standards' },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Scroll to top and close menu on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
    setIsMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans w-full flex flex-col selection:bg-black selection:text-white">
      {/* Navigation bar — iOS safe-area-inset-top keeps content below the notch */}
      <nav
        className="sticky top-0 z-50 bg-black text-white w-full border-b border-black"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-3 flex items-center justify-between">
          <Link href="/" className="flex flex-col group">
            <span className="font-headline font-bold text-[18px] uppercase tracking-widest leading-none group-hover:text-gray-300 transition-colors">
              RSR Crime Division
            </span>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 mt-1 leading-none">
              The Bureau — Los Angeles
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    isActive ? 'text-white' : 'text-[#999] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 -mr-2 text-white"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
            <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex flex-col">
              <span className="font-headline font-bold text-[18px] uppercase tracking-widest leading-none">
                RSR Crime Division
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 mt-1 leading-none">
                The Bureau — Los Angeles
              </span>
            </Link>
            <button
              className="p-2 -mr-2 text-white"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex flex-col p-4 gap-6 mt-8">
            {NAV_LINKS.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-semibold uppercase tracking-[0.15em] transition-colors ${
                    isActive ? 'text-white' : 'text-[#999] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-black text-white py-12 px-4 lg:px-8 mt-auto border-t border-black">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex flex-col gap-2">
            <h3 className="font-headline font-bold text-[18px] uppercase tracking-widest mb-2">
              RSR Crime Division · The Bureau — Los Angeles
            </h3>
            <p className="text-sm font-serif italic text-gray-400">
              Victim first. Facts second. Theories last.
            </p>
            <p className="text-sm font-serif italic text-gray-400">
              A red string is not evidence.
            </p>
          </div>
          
          <div className="flex flex-col gap-2 text-left md:text-right">
            <p className="text-xs uppercase tracking-widest text-gray-400">
              Los Angeles Crime Wire is a publication of RSR Crime Division
            </p>
            <p className="text-xs uppercase tracking-widest text-gray-400 mt-2">
              crimewire.rsrintel.com · coming soon
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-4">
              © RSR Crime Division. All rights reserved.
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
              We collect only what you give us.
            </p>
          </div>
        </div>
      </footer>
      {/* iOS home-indicator safe area */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', background: 'black' }} />
    </div>
  );
}
