'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Database, PlusCircle, User, LogOut, Shield } from 'lucide-react';

export default function Navigation() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-surface-container-lowest border-b border-outline-border py-4 px-4 md:px-8 flex justify-between items-center transition-colors shadow-sm sticky top-0 z-50">
      <div className="max-w-[1440px] w-full mx-auto flex justify-between items-center">
        <Link href="/" className="text-lg sm:text-2xl font-extrabold text-primary font-outfit tracking-tight hover:opacity-90 flex items-center gap-1.5 shrink-0">
          <span>SpatialAblate</span>
          <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary-container animate-pulse"></span>
        </Link>
        <nav className="flex gap-2.5 sm:gap-4 md:gap-6 items-center font-medium">
          <Link 
            href="/" 
            className="hover:text-primary-container text-on-surface-variant transition-colors text-sm font-semibold flex items-center gap-1.5"
          >
            <Database className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link 
            href="/ablation" 
            className="hover:text-primary-container text-on-surface-variant transition-colors text-sm font-semibold flex items-center gap-1.5"
          >
            <Database className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Ablation Studies</span>
          </Link>
          <Link 
            href="/submit" 
            className="hover:text-primary-container text-on-surface-variant transition-colors text-sm font-semibold flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Submit Model</span>
          </Link>

          {user && (
            <>
              {user.role === 'admin' && (
                <Link 
                  href="/admin" 
                  className="hover:text-primary-container text-on-surface-variant transition-colors text-sm font-semibold flex items-center gap-1.5"
                >
                  <Shield className="h-4 w-4 shrink-0 text-primary animate-pulse" />
                  <span className="hidden sm:inline">Admin Panel</span>
                </Link>
              )}
              
              {/* Subtle separator */}
              <div className="h-4 w-px bg-outline-border hidden sm:block"></div>
            </>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-default bg-surface-container-low hover:bg-surface-container hover:text-primary transition-all border border-outline-border cursor-pointer flex items-center justify-center text-on-surface-variant shrink-0"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="h-4 w-4 text-tertiary-container fill-tertiary-container" /> : <Moon className="h-4 w-4 text-on-surface" />}
          </button>

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <span className="text-on-surface font-semibold bg-surface-container-low px-2 sm:px-3.5 py-1.5 rounded-default border border-outline-border text-xs sm:text-sm flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[50px] sm:max-w-[120px] md:max-w-none inline-block">
                  {user.name}
                </span>
              </span>
              <button 
                onClick={logout}
                className="bg-surface-container-lowest hover:bg-error-container hover:text-error hover:border-error-container text-on-surface-variant px-2.5 sm:px-3.5 py-1.5 rounded-default text-xs sm:text-sm transition-all border border-outline-border cursor-pointer flex items-center gap-1.5 font-semibold shrink-0"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          ) : (
            <Link 
              href="/login" 
              className="bg-primary-container hover:bg-primary-container/90 text-white px-3 sm:px-4.5 py-1.5 rounded-default text-xs sm:text-sm transition-all cursor-pointer font-bold flex items-center gap-1.5 shrink-0"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
