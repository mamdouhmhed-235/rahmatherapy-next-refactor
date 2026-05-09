"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { AdminEmptyState } from "./admin-ui";

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for debugging; in production this could send to an error tracking service
    console.error("AdminErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AdminEmptyState
          icon={AlertTriangle}
          title={`${this.props.sectionName ?? "This section"} encountered an error`}
          message="Please refresh the page to try again. If the problem persists, contact support."
          tone="warning"
        />
      );
    }

    return this.props.children;
  }
}
