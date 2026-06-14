import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-full grid place-items-center p-6">
          <div className="card max-w-md w-full p-6 text-center">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-accent-soft text-accent grid place-items-center mb-4 text-xl">!</div>
            <h1 className="font-display text-xl mb-1">Something went wrong</h1>
            <p className="text-sm text-muted mb-4">A part of the app hit an error. Reloading usually fixes it.</p>
            <pre className="text-[11px] text-faint bg-canvas border border-line rounded-lg p-2 overflow-auto text-left mb-4">{String(this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => { this.setState({ error: null }); window.location.reload() }} className="btn btn-primary w-full">Reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
