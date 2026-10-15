import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Calendar, Users, DoorOpen, 
  Wallet, Settings, ArrowRight, 
  Fingerprint, FileText, BarChart3
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'booking' | 'guest' | 'room' | 'staff' | 'report' | 'setting';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

const mockSearchData: SearchResult[] = [
  { id: '1', type: 'booking', title: 'BK001 - Sarah Johnson', subtitle: 'Room 301, Mar 28-31', icon: Calendar, action: () => {} },
  { id: '2', type: 'booking', title: 'BK002 - Michael Chen', subtitle: 'Room 205, Mar 29-30', icon: Calendar, action: () => {} },
  { id: '3', type: 'guest', title: 'Sarah Johnson', subtitle: 'VIP Guest, 12 stays', icon: Users, action: () => {} },
  { id: '4', type: 'guest', title: 'David Nkosi', subtitle: 'Corporate, 15 stays', icon: Users, action: () => {} },
  { id: '5', type: 'room', title: 'Room 301', subtitle: 'Presidential Suite, Available', icon: DoorOpen, action: () => {} },
  { id: '6', type: 'room', title: 'Room 502', subtitle: 'Suite, Occupied', icon: DoorOpen, action: () => {} },
  { id: '7', type: 'staff', title: 'James Mkhize', subtitle: 'Housekeeping Manager', icon: Fingerprint, action: () => {} },
  { id: '8', type: 'staff', title: 'Maria Santos', subtitle: 'Front Desk', icon: Fingerprint, action: () => {} },
  { id: '9', type: 'report', title: 'Monthly Revenue Report', subtitle: 'Financial', icon: FileText, action: () => {} },
  { id: '10', type: 'report', title: 'Occupancy Analysis', subtitle: 'Analytics', icon: BarChart3, action: () => {} },
  { id: '11', type: 'setting', title: 'Rate Management', subtitle: 'Configure room rates', icon: Settings, action: () => {} },
  { id: '12', type: 'setting', title: 'User Management', subtitle: 'Manage staff accounts', icon: Settings, action: () => {} },
];

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const GlobalSearch = ({ isOpen, onClose, onNavigate }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim()) {
      const filtered = mockSearchData.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const handleSelect = (result: SearchResult) => {
    // Navigate based on type
    const pageMap: Record<string, string> = {
      booking: 'bookings',
      guest: 'guests',
      room: 'rooms',
      staff: 'staff',
      report: 'reports',
      setting: 'settings',
    };
    onNavigate(pageMap[result.type] || 'dashboard');
    onClose();
    setQuery('');
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    const labels: Record<string, string> = {
      booking: 'Booking',
      guest: 'Guest',
      room: 'Room',
      staff: 'Staff',
      report: 'Report',
      setting: 'Setting',
    };
    return labels[type] || type;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Search Modal */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50"
          >
            <div className="bg-card border border-border rounded-2xl shadow-overlay overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search bookings, guests, rooms, staff..."
                  className="flex-1 bg-transparent text-lg focus:outline-none"
                />
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Results */}
              {query.trim() && (
                <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                  {results.length === 0 ? (
                    <div className="p-8 text-center">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No results found for "{query}"</p>
                      <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {results.map((result, index) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                            index === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            result.type === 'booking' ? 'bg-info/15 text-info' :
                            result.type === 'guest' ? 'bg-success/15 text-success' :
                            result.type === 'room' ? 'bg-purple-500/20 text-purple-400' :
                            result.type === 'staff' ? 'bg-orange-500/20 text-orange-400' :
                            result.type === 'report' ? 'bg-warning/15 text-warning' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            <result.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-muted rounded-full">
                              {getTypeLabel(result.type)}
                            </span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions (when no query) */}
              {!query.trim() && (
                <div className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 px-2">QUICK ACTIONS</p>
                  <div className="space-y-1">
                    {[
                      { label: 'New Booking', page: 'bookings', icon: Calendar },
                      { label: 'Check-In Guest', page: 'checkin', icon: Users },
                      { label: 'View Reports', page: 'reports', icon: FileText },
                      { label: 'Manage Rates', page: 'rates', icon: Wallet },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => { onNavigate(action.page); onClose(); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                      >
                        <action.icon className="w-5 h-5 text-muted-foreground" />
                        <span className="flex-1">{action.label}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd> Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> Close
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearch;