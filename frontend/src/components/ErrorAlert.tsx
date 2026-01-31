import { useState } from 'react';

interface ErrorAlertProps {
  title?: string;
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
}

// Simple error logging - in production this would send to a logging service
function logError(error: Error | string, context?: string) {
  const errorData = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  // Log to console in development
  console.error('[Error Report]', errorData);

  // Store in localStorage for debugging (keeps last 10 errors)
  try {
    const stored = localStorage.getItem('error_logs');
    const logs = stored ? JSON.parse(stored) : [];
    logs.unshift(errorData);
    localStorage.setItem('error_logs', JSON.stringify(logs.slice(0, 10)));
  } catch {
    // Ignore storage errors
  }
}

export default function ErrorAlert({
  title = 'Something went wrong',
  message = 'We had trouble loading this page. Please try again.',
  error,
  onRetry
}: ErrorAlertProps) {
  const [reported, setReported] = useState(false);

  const handleReport = () => {
    if (error) {
      logError(error, title);
    }
    setReported(true);
  };

  return (
    <div className="error-alert">
      <div className="error-alert-icon">!</div>
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="error-alert-actions">
        {onRetry && (
          <button onClick={onRetry} className="btn btn-primary">
            Try Again
          </button>
        )}
        {error && !reported && (
          <button onClick={handleReport} className="btn btn-outline">
            Report Issue
          </button>
        )}
        {reported && (
          <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
            Issue reported - thanks!
          </span>
        )}
      </div>
    </div>
  );
}
