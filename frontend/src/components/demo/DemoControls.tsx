import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, RotateCcw, Shield, Eye, Pause, ChevronDown
} from 'lucide-react';
import { setDemoMode, isDemoMode } from '../../lib/mockApi';
import { seedDatabase, resetDatabase } from '../../lib/dataSeeder';
import { useAppStore } from '../../store/useAppStore';
import { type UserRole, getRoleLabel, ROLE_PERMISSIONS } from '../../lib/rbac';

interface DemoControlsProps {
  children?: React.ReactNode;
}

export function DemoControls({ children }: DemoControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [demo, setDemo] = useState(() => isDemoMode());
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const { user, setUser } = useAppStore();

  const toggleDemoMode = () => {
    const newValue = !demo;
    setDemo(newValue);
    setDemoMode(newValue);
  };

  const handleReset = () => {
    if (confirm('This will reset all data to default demo values. Continue?')) {
      setIsSeeding(true);
      setTimeout(() => {
        resetDatabase();
        seedDatabase();
        setIsSeeding(false);
        alert('Database reset complete!');
      }, 500);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    const mockUsers = [
      { id: '1', name: 'Admin User', email: 'admin@nexus.com', role: 'admin', department: 'Management', phone: '+27821234567', hireDate: '2020-01-01', status: 'active' as const },
      { id: '2', name: 'Manager User', email: 'manager@nexus.com', role: 'manager', department: 'Operations', phone: '+27821234568', hireDate: '2021-03-15', status: 'active' as const },
      { id: '3', name: 'Front Desk', email: 'frontdesk@nexus.com', role: 'front_desk', department: 'Front Desk', phone: '+27821234569', hireDate: '2022-06-01', status: 'active' as const },
      { id: '4', name: 'Housekeeping Lead', email: 'housekeeping@nexus.com', role: 'housekeeping', department: 'Housekeeping', phone: '+27821234570', hireDate: '2021-09-01', status: 'active' as const },
      { id: '5', name: 'Auditor', email: 'auditor@nexus.com', role: 'auditor', department: 'Finance', phone: '+27821234571', hireDate: '2023-01-15', status: 'active' as const },
    ];
    
    const newUser = mockUsers.find(u => u.role === role) || mockUsers[0];
    setUser(newUser);
    setShowRoleSwitcher(false);
  };

  const currentRole = (user?.role as UserRole) || 'front_desk';

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-colors ${
              demo 
                ? 'bg-success hover:bg-green-600 text-white' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {demo ? (
              <><Zap className="w-4 h-4" /><span className="text-sm font-medium">Demo Mode</span></>
            ) : (
              <><Eye className="w-4 h-4" /><span className="text-sm font-medium">Demo</span></>
            )}
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full mb-2 right-0 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
              >
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold mb-1">Demo Controls</h3>
                  <p className="text-xs text-muted-foreground">Investor presentation settings</p>
                </div>

                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {demo ? <Zap className="w-4 h-4 text-success" /> : <Pause className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm">Fast Mode</span>
                    </div>
                    <button
                      onClick={toggleDemoMode}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        demo ? 'bg-success' : 'bg-muted'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        demo ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span>{getRoleLabel(currentRole)}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showRoleSwitcher ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showRoleSwitcher && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10"
                        >
                          {Object.keys(ROLE_PERMISSIONS).filter(r => r !== 'guest').map(role => (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(role as UserRole)}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors ${
                                currentRole === role ? 'bg-primary/10 text-primary' : ''
                              }`}
                            >
                              <Shield className="w-4 h-4" />
                              {getRoleLabel(role as UserRole)}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={handleReset}
                    disabled={isSeeding}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
                    {isSeeding ? 'Resetting...' : 'Reset Demo Data'}
                  </button>

                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Keyboard Shortcuts:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">Ctrl+Shift+R</kbd>
                        <span className="text-muted-foreground">Reset</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">Ctrl+D</kbd>
                        <span className="text-muted-foreground">Demo</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-muted/50 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span>Current: {getRoleLabel(currentRole)}</span>
                    <span className="text-primary">•</span>
                    <span>{demo ? 'Fast responses' : 'Simulated latency'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {children}
    </>
  );
}

export function useDemoMode() {
  const [demo, setDemo] = useState(() => isDemoMode());

  useEffect(() => {
    const interval = setInterval(() => {
      setDemo(isDemoMode());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return demo;
}

export function PermissionGate({ 
  permission, 
  children, 
  fallback = null 
}: { 
  permission: keyof typeof ROLE_PERMISSIONS.admin;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = useAppStore();
  const role = (user?.role as UserRole) || 'front_desk';
  const hasPermission = ROLE_PERMISSIONS[role]?.[permission] ?? false;

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
