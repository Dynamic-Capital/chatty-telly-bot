import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Bot, Home } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              DC
            </div>
            Dynamic Capital
          </Link>
          
          <nav className="flex items-center gap-2">
            <Button
              asChild
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
            >
              <Link to="/" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Bot Dashboard
              </Link>
            </Button>
            
            <Button
              asChild
              variant={isActive('/education') ? 'default' : 'ghost'}
              size="sm"
            >
              <Link to="/education" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Education
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;