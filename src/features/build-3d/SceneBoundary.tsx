import { Component, type ReactNode } from "react";

export class SceneBoundary extends Component<
  { children: ReactNode; onFallback: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <div className="v3-scene-fallback">
          <p>The 3D scene could not load. Your build is still available in 2D.</p>
          <button type="button" onClick={this.props.onFallback}>
            Use 2D view
          </button>
        </div>
      );
    return this.props.children;
  }
}
