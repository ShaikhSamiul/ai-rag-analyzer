import { useState, useEffect } from 'react';

/**
 * Component that pings the Render backend on initial load.
 * Displays a warning toast if the server takes longer than 3 seconds to respond,
 * indicating a "Cold Start" wake-up process.
 */
export default function ServerStatusBanner() {
    const [isWakingBackend, setIsWakingBackend] = useState(false);

    useEffect(() => {
        const wakeUpBackend = async () => {
            // Trigger the banner if the backend hasn't responded in 3 seconds
            const sleepTimer = setTimeout(() => {
                setIsWakingBackend(true);
            }, 3000);

            try {
                // Ping the lightweight health endpoint
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/wakeup`);
            } catch (error) {
                console.error("Backend health check failed:", error);
            } finally {
                // Once the request finishes (success or fail), clear the timer and hide the banner
                clearTimeout(sleepTimer);
                setIsWakingBackend(false);
            }
        };

        wakeUpBackend();
    }, []); // Empty dependency array ensures this only runs once on initial load

    // If the backend is fast (or already awake), don't render anything
    if (!isWakingBackend) return null;

    return (
        <div style={{
            backgroundColor: '#fef08a',
            color: '#854d0e',
            padding: '12px',
            textAlign: 'center',
            fontWeight: 'bold',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
            ⏳ Wait for a minute as the Render backend is starting. It may take up to a minute...
        </div>
    );
}