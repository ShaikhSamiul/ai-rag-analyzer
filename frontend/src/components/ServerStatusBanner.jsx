import { useState, useEffect } from 'react';

/**
 * Component that pings the Render backend on initial load.
 * Displays a warning notification if the server takes longer than 3 seconds to respond,
 * indicating a "Cold Start" wake-up process.
 *
 * NOTE: Currently force-displayed for visual review per user request.
 */
export default function ServerStatusBanner() {
    // Temporarily set to true so you can inspect its styling and animation right now
    // eslint-disable-next-line no-unused-vars
    const [isWakingBackend, setIsWakingBackend] = useState(true);

    useEffect(() => {
        const wakeUpBackend = async () => {
            try {
                // Ping the lightweight health endpoint
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/wakeup`);
            } catch (error) {
                console.error("Backend health check failed:", error);
            }
        };

        wakeUpBackend();
    }, []);

    // Visible for current user review
    if (!isWakingBackend) return null;

    return (
        <div className="server-status-banner">
            <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
            </svg>
            <span>Connecting to backend server. Render free-tier cold starts may take up to a minute...</span>
        </div>
    );
}
