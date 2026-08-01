import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { routeLogger } from "../lib/logger";

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  error: Error | null;
};

function formatErrorMessage(error: Error): string {
  if (import.meta.env.DEV) {
    return error.message || "Unknown error";
  }
  return "页面加载时出现问题，请返回列表后重试。";
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    routeLogger.error("Uncaught render error", error, {
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="orbit-content orbit-route-error" role="alert">
        <h2 className="orbit-route-error-title">页面暂时无法显示</h2>
        <p className="orbit-route-error-message">{formatErrorMessage(error)}</p>
        {import.meta.env.DEV && error.stack && (
          <pre className="orbit-route-error-stack">{error.stack}</pre>
        )}
        <div className="orbit-route-error-actions">
          <button type="button" className="orbit-btn" onClick={this.handleRetry}>
            重试
          </button>
          <Link to="/diary" className="orbit-btn orbit-btn-primary" onClick={this.handleRetry}>
            返回日记
          </Link>
        </div>
      </div>
    );
  }
}
