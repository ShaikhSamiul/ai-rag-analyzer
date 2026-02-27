import { useState, useEffect, useRef } from 'react';

/**
 * Component for handling the conversational AI interface.
 * Allows users to send questions to the backend and displays the AI's contextual responses
 * within a responsive, auto-scrolling chat window.
 *
 * @param {Object} props
 * @param {boolean} props.isFileProcessed - Determines if the chat interface should be enabled based on document upload status.
 * @returns {JSX.Element} The rendered ChatInterface component.
 */
export default function ChatInterface({ isFileProcessed, sessionId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Reference to the bottom of the chat window to anchor the auto-scroll behavior
    const messagesEndRef = useRef(null);

    /**
     * Automatically scrolls to the newest message seamlessly 
     * whenever the messages array updates or the loading state changes.
     */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    /**
     * Handles the submission of a user query.
     * Updates the UI optimistically, routes the query to the FastAPI RAG backend,
     * and appends the AI's response to the conversation log.
     *
     * @param {React.FormEvent} e - The form submission event.
     */
    const handleSend = async (e) => {
        e.preventDefault(); 
        if (!input.trim()) return;

        // Optimistically update UI with the user's message
        const userMessage = { role: 'user', text: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch("https://ai-rag-analyzer-api.onrender.com/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: userMessage.text, session_id: sessionId }),
            });

            if (!response.ok) throw new Error("Failed to retrieve an answer from the AI service.");

            const data = await response.json();
            const aiMessage = { role: 'ai', text: data.answer };
            setMessages((prev) => [...prev, aiMessage]);

        } catch (error) {
            console.error("Chat API error:", error);
            const errorMessage = { role: 'ai', text: "Sorry, I encountered an error while processing your request." };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h2>2. Chat with AI</h2>
            
            <div className="chat-window" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px', 
                overflowY: 'auto', 
                height: '45vh', 
                maxHeight: '500px', 
                padding: '20px',
                backgroundColor: '#ffffff', 
                borderRadius: '12px',
                border: '1px solid #e2e8f0', 
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}>
                {messages.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#64748b', margin: 'auto' }}>
                        {isFileProcessed ? "Document processed! Ask me anything." : "Upload and process a document to start chatting..."}
                    </p>
                ) : (
                    messages.map((msg, index) => (
                        <div key={index} style={{ 
                            display: 'flex', 
                            width: '100%', 
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            flexShrink: 0 /* Prevents flexbox from squishing older messages */
                        }}>
                            <div style={{ 
                                maxWidth: '80%', 
                                padding: '12px 16px', 
                                borderRadius: msg.role === 'user' ? '16px 16px 0px 16px' : '16px 16px 16px 0px', 
                                backgroundColor: msg.role === 'user' ? '#2563eb' : '#f1f5f9',
                                color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                wordWrap: 'break-word',
                                fontSize: '0.95rem',
                                lineHeight: '1.5'
                            }}>
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', flexShrink: 0 }}>
                        <div style={{ padding: '12px 16px', backgroundColor: '#f1f5f9', borderRadius: '16px 16px 16px 0px', color: '#64748b', fontSize: '0.95rem' }}>
                            <span className="typing-indicator">AI is thinking...</span>
                        </div>
                    </div>
                )}
                
                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSend} className="chat-input-area" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <input 
                    type="text" 
                    placeholder={isFileProcessed ? "Ask a question..." : "Upload a document first..."} 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading || !isFileProcessed}
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem' }}
                />
                <button 
                    type="submit" 
                    disabled={isLoading || !input.trim() || !isFileProcessed}
                    style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: (isLoading || !input.trim() || !isFileProcessed) ? '#94a3b8' : '#0f172a', color: 'white', border: 'none', cursor: (isLoading || !input.trim() || !isFileProcessed) ? 'not-allowed' : 'pointer', fontWeight: '600' }}
                >
                    {isLoading ? '...' : 'Send'}
                </button>
            </form>
        </div>
    );
}