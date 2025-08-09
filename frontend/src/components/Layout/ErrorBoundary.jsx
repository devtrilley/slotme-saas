// components/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto mt-10 p-6 text-center bg-base-200 border border-red-500 rounded-lg space-y-3">
          <h2 className="text-lg font-bold text-red-500">
            ⚠️ Something went wrong
          </h2>
          <p className="text-sm text-gray-400">
            The page encountered a crash and couldn't render. Try refreshing or
            logging back in.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-sm btn-outline btn-error"
          >
            🔄 Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
