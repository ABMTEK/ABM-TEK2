import { cn } from "@/lib/utils";

interface PageLoaderProps {
    message?: string;
    className?: string;
}

export function PageLoader({ message = "Loading...", className }: PageLoaderProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center min-h-[60vh] gap-6", className)}>
            {/* Animated dots loader */}
            <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-900 animate-[bounce_1.4s_ease-in-out_0s_infinite]" />
                <div className="h-3 w-3 rounded-full bg-gray-700 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <div className="h-3 w-3 rounded-full bg-gray-500 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
            <p className="text-sm font-medium text-gray-400 tracking-wide">{message}</p>
        </div>
    );
}

export function TableLoader({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <tr key={rowIdx} className="animate-pulse">
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <td key={colIdx} className="px-6 py-4">
                            <div
                                className="h-4 bg-gray-100 rounded-lg"
                                style={{ width: `${50 + Math.random() * 40}%` }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
