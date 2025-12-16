interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullScreen?: boolean;
}

export default function Loading({ size = "md", text, fullScreen = false }: LoadingProps) {
  const sizeClasses = {
    sm: "w-8 h-8 border-2",
    md: "w-12 h-12 border-3",
    lg: "w-16 h-16 border-4",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const containerClasses = fullScreen
    ? "flex flex-col items-center justify-center min-h-screen gap-4"
    : "flex flex-col items-center justify-center gap-4";

  return (
    <div className={containerClasses}>
      <div className="relative">
        {/* Spinner principal */}
        <div
          className={`${sizeClasses[size]} border-gray-200 border-t-primary rounded-full animate-spin`}
        />
        
        {/* Ponto central para dar mais estilo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'} bg-primary rounded-full animate-pulse`} />
        </div>
      </div>
      
      {text && (
        <p className={`${textSizeClasses[size]} text-gray-600 font-medium animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );
}
