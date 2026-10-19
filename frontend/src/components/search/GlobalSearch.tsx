import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Calendar, Users, DoorOpen, 
  Wallet, Settings, ArrowRight, 
  Fingerprint, FileText, BarChart3
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface SearchResult {
  id: string;
  type: 'booking' | 'guest' | 'room' | 'staff' | 'report' | 'setting';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const staticLinks: SearchResult[] = [
  { id: 'report-revenue', type: 'report', title: 'Monthly Revenue Report', subtitle: 'Financial', icon: FileText },
  { id: 'report-occupancy', type: 'report', title: 'Occupancy Analysis', subtitle: 'Analytics', icon: BarChart3 },
  { id: 'setting-rates', type: 'setting', title: 'Rate Management', subtitle: 'Configure room rates', icon: Settings },
  { id: 'setting-users', type: 'setting', title: 'User Management', subtitle: 'Manage staff accounts', icon: Settings },
];

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const GlobalSearch = ({ isOpen, onClose, onNavigate }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bookings = useAppStore((s) => s.bookings);
  const guests = useAppStore((s) => s.guests);
  const rooms = useAppStore((s) => s.rooms);
  const users = useAppStore((s) => s.users);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Derived (not stored) so filtering never round-trips through setState-in-effect.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const index: SearchResult[] = [
      ...bookings.map((b) => ({
        id: `booking-${b.id}`,
        type: 'booking' as const,
        title: `${b.guestName} - Room ${b.roomNumber}`,
        subtitle: `${shortDate(b.checkIn)} - ${shortDate(b.checkOut)} · ${b.status.replace('-', ' ')}`,
        icon: Calendar,
      })),
      ...guests.map((g) => ({
        id: `guest-${g.id}`,
        type: 'guest' as const,
        title: g.name,
        subtitle: `${g.segment} · ${g.totalStays} stays`,
        icon: Users,
      })),
      ...rooms.map((r) => ({
        id: `room-${r.id}`,
        type: 'room' as const,
        title: `Room ${r.number}`,
        subtitle: `${r.type} · ${r.status}`,
        icon: DoorOpen,
      })),
      ...users.map((u) => ({
        id: `staff-${u.id}`,
        type: 'staff' as const,
        title: u.name,
        subtitle: `${u.role.replace(/_/g, ' ')}${u.department ? ` · ${u.department}` : ''}`,
        icon: Fingerprint,
      })),
      ...staticLinks,
    ];
    return index
      .filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
      .slice(0, 40);
  }, [query, bookings, guests, rooms, users]);

  // Clamp instead of resetting when the result set shrinks.
  const safeIndex = Math.min(selectedIndex, results.length - 1);

  const handleSelect = useCallback((result: SearchResult) => {
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
  }, [onNavigate, onClose]);

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
          if (results[safeIndex]) {
            handleSelect(results[safeIndex]);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, safeIndex, onClose, handleSelect]);

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
                            index === safeIndex ? 'bg-primary/10' : 'hover:bg-muted'
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