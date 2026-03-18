"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** If provided, shown as a download link for the raw DXF when viewer crashes */
  dxfUrl?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <svg
            className="h-10 w-10 text-destructive/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div className="space-y-1">
            <p className="font-medium text-destructive">Görüntüleyici çöktü</p>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "Beklenmeyen bir hata oluştu"}
            </p>
          </div>
          {this.props.dxfUrl && (
            <a
              href={this.props.dxfUrl}
              download
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Ham DXF İndir
            </a>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Yeniden dene
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
