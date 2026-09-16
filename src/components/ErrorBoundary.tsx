import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Um erro dentro de um ecrã desmontava a árvore toda e deixava o fundo branco.
 * Com isto, fica uma mensagem e um botão para recarregar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GFit rebentou:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app">
        <div className="screen screen--plain">
          <h1 className="title">Alguma coisa correu mal</h1>
          <p className="subtitle">
            O ecrã não conseguiu abrir. Recarrega; se continuar, manda-me esta
            mensagem.
          </p>
          <p className="error-banner">{error.message}</p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
