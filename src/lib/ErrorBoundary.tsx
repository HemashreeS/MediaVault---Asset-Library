import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep detailed diagnostics in the console for development/debugging.
    console.error('Application component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
    });
  };

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary" role="alert">
          <div className="error-boundary__content">
            <h1>Something went wrong</h1>

            <p>
              This section could not be displayed. You can try again or reload
              the application.
            </p>

            <div className="row">
              <button onClick={this.handleRetry}>
                Try again
              </button>

              <button onClick={this.handleReset}>
                Reload application
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
