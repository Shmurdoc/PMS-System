import { useState } from 'react';
import { 
  Layers, Eye, EyeOff, Lock, Mail, AlertTriangle, 
  Loader2
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => void | Promise<void>;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState('admin@nexus.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { email: 'admin@nexus.com', password: 'admin123', role: 'Admin', name: 'John Doe' },
    { email: 'manager@nexus.com', password: 'manager123', role: 'Manager', name: 'Sarah Johnson' },
    { email: 'front@nexus.com', password: 'front123', role: 'Front Desk', name: 'Mike Chen' },
  ];

  const quickLogin = (user: typeof demoUsers[0]) => {
    setEmail(user.email);
    setPassword(user.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left - Branding */}
        <div className="hidden md:block space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">NEXUS PMS</h1>
              <p className="text-xs text-muted-foreground">Property Management System</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-medium mb-1">Enterprise Security</p>
              <p className="text-xs text-muted-foreground">End-to-end encryption with role-based access control</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-medium mb-1">Multi-Property</p>
              <p className="text-xs text-muted-foreground">Manage hotels, resorts, and lodges from one dashboard</p>
            </div>
          </div>

          {/* Quick Demo Access */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick Demo Access:</p>
            <div className="space-y-1.5">
              {demoUsers.map((user) => (
                <button
                  key={user.email}
                  onClick={() => quickLogin(user)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-left hover:bg-muted transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">{user.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Login Form */}
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">NEXUS PMS</h1>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold mb-1">Welcome Back</h2>
              <p className="text-xs text-muted-foreground">Sign in to your account</p>
            </div>

            {error && (
              <div className="mb-3 p-2.5 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-3.5 h-3.5 rounded border-border" />
                  <span className="text-xs text-muted-foreground">Remember me</span>
                </label>
                <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="mt-4 p-2.5 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Demo: admin@nexus.com / admin123</p>
            </div>

            {/* Mobile Quick Access */}
            <div className="md:hidden mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-2">Quick Demo Access:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {demoUsers.map((user) => (
                  <button key={user.email} onClick={() => quickLogin(user)} className="p-2 bg-muted/50 rounded-lg text-center hover:bg-muted transition-colors">
                    <p className="text-xs font-medium">{user.role}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">© 2026 NEXUS PMS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;