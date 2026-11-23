import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Redro Web Designer crashed while rendering.", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <div className="fatal-error-mark">R</div>
          <h1>Redro could not open this workspace</h1>
          <p>The editor encountered an unexpected error. Your saved local project has not been intentionally deleted.</p>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()}>Reload editor</button>
        </main>
      );
    }
    return this.props.children;
  }
}
