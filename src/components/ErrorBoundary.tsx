import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    try {
      window.location.href = window.location.origin;
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF5F8] flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-pink-100 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-1">
              Đã Xảy Ra Sự Cố Nhỏ
            </h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Ứng dụng vừa gặp một lỗi bộ nhớ tạm thời. Bạn có thể bấm nút bên dưới để quay lại trang chủ chụp ảnh tiếp nhé!
            </p>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>🏠 Quay Lại Trang Chủ</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tải Lại Ứng Dụng</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
