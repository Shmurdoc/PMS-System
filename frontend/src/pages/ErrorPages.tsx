import { motion } from 'framer-motion';
import { 
  Home, ArrowLeft, Search, HelpCircle, AlertTriangle, 
  Server, WifiOff, RefreshCw
} from 'lucide-react';

// 404 Page
export const NotFoundPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-md"
    >
      <div className="relative mb-8">
        <h1 className="text-[150px] font-bold text-primary/20 leading-none">404</h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <Search className="w-20 h-20 text-primary" />
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Home className="w-5 h-5" />
          Go to Dashboard
        </button>
        <button
          onClick={() => window.history.back()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>
      </div>
    </motion.div>
  </div>
);

// 500 Server Error Page
export const ServerErrorPage = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-md"
    >
      <div className="w-24 h-24 bg-danger/15 rounded-full flex items-center justify-center mx-auto mb-6">
        <Server className="w-12 h-12 text-danger" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Server Error</h2>
      <p className="text-muted-foreground mb-8">
        Something went wrong on our end. Please try again later.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Reload Page
        </button>
      </div>
    </motion.div>
  </div>
);

// Network Error Page
export const NetworkErrorPage = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-md"
    >
      <div className="w-24 h-24 bg-warning/15 rounded-full flex items-center justify-center mx-auto mb-6">
        <WifiOff className="w-12 h-12 text-warning" />
      </div>
      <h2 className="text-2xl font-bold mb-2">No Internet Connection</h2>
      <p className="text-muted-foreground mb-8">
        Please check your internet connection and try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Retry Connection
        </button>
      )}
    </motion.div>
  </div>
);

// Maintenance Page
export const MaintenancePage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-md"
    >
      <div className="w-24 h-24 bg-info/15 rounded-full flex items-center justify-center mx-auto mb-6">
        <HelpCircle className="w-12 h-12 text-info" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Under Maintenance</h2>
      <p className="text-muted-foreground mb-4">
        We're performing scheduled maintenance. We'll be back shortly.
      </p>
      <p className="text-sm text-muted-foreground">
        Expected downtime: 30 minutes
      </p>
    </motion.div>
  </div>
);

// Error Boundary Component
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-danger/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-danger" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NotFoundPage;