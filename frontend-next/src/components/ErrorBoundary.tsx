"use client";
import React from "react";

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div className="p-4 text-red-500">出错了：{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}
