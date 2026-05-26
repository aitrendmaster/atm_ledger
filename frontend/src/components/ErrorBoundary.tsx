import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

const LOCALE_KEY = 'moa_locale'

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary] caught:', error, info)
  }

  private retry = () => {
    this.setState({ hasError: false, error: null })
  }

  private clearAndRestart = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* storage 접근 자체가 실패해도 reload 는 강행 */
    }
    location.reload()
  }

  private resetLocaleAndRestart = () => {
    try {
      localStorage.removeItem(LOCALE_KEY)
    } catch {
      /* ignore */
    }
    location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#F5F1EA',
          fontFamily: "'Noto Sans KR', system-ui, sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>😵‍💫</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C2418', marginBottom: 8 }}>
          앱에 오류가 발생했어요
        </h1>
        <p style={{ fontSize: 14, color: '#7A7567', marginBottom: 24, maxWidth: 320 }}>
          잠시 후 다시 시도하시거나, 문제가 계속되면 아래 버튼으로 캐시를 비우고 재시작해 주세요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
          <button
            onClick={this.retry}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: '#2C2418',
              color: '#FFFDF8',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          <button
            onClick={this.resetLocaleAndRestart}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: '#FFFDF8',
              color: '#2C2418',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid #E8E2D5',
              cursor: 'pointer',
            }}
          >
            언어 설정 초기화 후 재시작
          </button>
          <button
            onClick={this.clearAndRestart}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: 'transparent',
              color: '#A0633C',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid #E8E2D5',
              cursor: 'pointer',
            }}
          >
            전체 캐시 비우고 재시작
          </button>
        </div>
        {this.state.error && (
          <details style={{ marginTop: 24, fontSize: 11, color: '#7A7567', maxWidth: 320 }}>
            <summary style={{ cursor: 'pointer' }}>오류 상세 정보</summary>
            <pre
              style={{
                marginTop: 8,
                padding: 8,
                backgroundColor: '#FFFDF8',
                border: '1px solid #E8E2D5',
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}
            >
              {this.state.error.message}
            </pre>
          </details>
        )}
      </div>
    )
  }
}
