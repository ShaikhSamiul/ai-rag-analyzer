import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
    { label: "Summarize Document", icon: "⚡", prompt: "Can you provide a comprehensive summary of this document?" },
    { label: "Key Takeaways", icon: "📋", prompt: "What are the most important key takeaways from this document?" },
    { label: "Main Conclusions", icon: "💡", prompt: "What are the primary conclusions and recommendations in this document?" },
];

/**
 * Component for handling the conversational AI interface.
 * Features:
 * - Active document context header badge
 * - Auto-expanding multi-line textarea with hidden native scrollbar
 * - Global keyboard shortcut (/ or Ctrl+K) to focus input
 * - Floating "Scroll to Latest" down-arrow button
 * - Export chat conversation to Markdown (.md)
 * - Grounding Source Context Accordion showing Pinecone chunks
 * - Real-time word-by-word typewriter response streaming with terminal cursor
 * - Quick prompt suggestion chips
 * - Copy-to-clipboard for AI answers
 * - Conversation clear button
 *
 * @param {Object} props
 * @param {boolean} props.isFileProcessed - Determines if chat is active.
 * @param {string} props.sessionId - Active session ID matching the Pinecone namespace.
 * @param {string} [props.activeDocName] - Active document name being analyzed.
 * @returns {JSX.Element} The rendered ChatInterface component.
 */
export default function ChatInterface({ isFileProcessed, sessionId, activeDocName }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // References
    const messagesEndRef = useRef(null);
    const chatWindowRef = useRef(null);
    const textareaRef = useRef(null);
    const streamIntervalRef = useRef(null);
    const isUserScrolledUpRef = useRef(false);

    // Track scroll position to conditionally show "Scroll to Latest" button
    const handleScroll = () => {
        const el = chatWindowRef.current;
        if (!el) return;
        const isScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 120;
        setShowScrollBottom(isScrolledUp);
        isUserScrolledUpRef.current = isScrolledUp;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollBottom(false);
        isUserScrolledUpRef.current = false;
    };

    // Auto-scroll on new messages or streaming updates unless user manually scrolled up
    useEffect(() => {
        if (!isUserScrolledUpRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isStreaming]);

    // Global keyboard shortcut: press "/" or "Ctrl+K" / "Cmd+K" to focus chat textarea
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const activeTag = document.activeElement?.tagName?.toLowerCase();
                if (activeTag !== 'input' && activeTag !== 'textarea' && !document.activeElement?.isContentEditable) {
                    e.preventDefault();
                    textareaRef.current?.focus();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Clean up active streaming interval on unmount
    useEffect(() => {
        return () => {
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        };
    }, []);

    // Reset conversation if document is removed or new session begins
    useEffect(() => {
        if (!isFileProcessed) {
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
            setMessages([]);
            setInput('');
            setIsStreaming(false);
            setShowScrollBottom(false);
            isUserScrolledUpRef.current = false;
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.overflowY = 'hidden';
            }
        }
    }, [isFileProcessed, sessionId]);

    // Auto-adjust textarea height on input change and manage overflow without scrollbar
    const handleInputChange = (e) => {
        setInput(e.target.value);
        adjustTextareaHeight();
    };

    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 120);
            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
        }
    };

    /**
     * Executes query and initiates typewriter streaming simulation of the response.
     */
    const sendQuestion = async (queryText) => {
        const text = (queryText || input).trim();
        if (!text || isLoading || isStreaming || !isFileProcessed) return;

        // Clean up any lingering stream interval
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);

        // Optimistically update UI with user message
        const userMessage = { role: 'user', text };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }
        setIsLoading(true);
        isUserScrolledUpRef.current = false;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: userMessage.text, session_id: sessionId }),
            });

            if (!response.ok) throw new Error("Failed to retrieve an answer from the AI service.");

            const data = await response.json();
            const fullAnswer = data.answer || "I could not find an answer in the document.";
            const sources = Array.isArray(data.sources) ? data.sources : [];

            // Switch from loading spinner to typewriter stream
            setIsLoading(false);
            setIsStreaming(true);

            // Tokenize text preserving whitespace and newlines for natural pacing
            const chunks = fullAnswer.split(/(\s+)/);
            let streamedText = '';
            let chunkIdx = 0;

            // Append empty placeholder AI message
            setMessages((prev) => [...prev, { role: 'ai', text: '', streaming: true, sources: [] }]);

            streamIntervalRef.current = setInterval(() => {
                if (chunkIdx < chunks.length) {
                    streamedText += chunks[chunkIdx];
                    chunkIdx++;
                    setMessages((prev) => {
                        if (prev.length === 0) return prev;
                        const next = [...prev];
                        next[next.length - 1] = {
                            role: 'ai',
                            text: streamedText,
                            streaming: true,
                            sources: [],
                        };
                        return next;
                    });
                } else {
                    // Streaming complete: attach full text and context sources
                    clearInterval(streamIntervalRef.current);
                    streamIntervalRef.current = null;
                    setIsStreaming(false);
                    setMessages((prev) => {
                        if (prev.length === 0) return prev;
                        const next = [...prev];
                        next[next.length - 1] = {
                            role: 'ai',
                            text: fullAnswer,
                            sources: sources,
                            streaming: false,
                        };
                        return next;
                    });
                }
            }, 18); // 18ms per token gives crisp, smooth high-speed streaming

        } catch (error) {
            console.error("Chat API error:", error);
            setIsLoading(false);
            setIsStreaming(false);
            const errorMessage = { role: 'ai', text: "Sorry, I encountered an error while processing your request. Please try again." };
            setMessages((prev) => [...prev, errorMessage]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendQuestion();
        }
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleClearChat = () => {
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        setMessages([]);
        setInput('');
        setIsStreaming(false);
        setShowScrollBottom(false);
        isUserScrolledUpRef.current = false;
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }
    };

    /**
     * Exports the active conversation and grounding sources as a structured Markdown file.
     */
    const handleExportChat = () => {
        if (messages.length === 0) return;
        const title = activeDocName ? activeDocName.replace(/\.pdf$/i, '') : 'Document';
        const timestamp = new Date().toLocaleString();
        
        let md = `# RAG Document Analysis: ${title}\n\n`;
        md += `- **Export Date:** ${timestamp}\n`;
        if (sessionId) md += `- **Session ID:** \`${sessionId}\`\n`;
        md += `- **Total Messages:** ${messages.length}\n\n`;
        md += `---\n\n`;
        
        messages.forEach((msg) => {
            if (msg.role === 'user') {
                md += `### 💬 Question\n\n${msg.text}\n\n`;
            } else {
                md += `### 🤖 Gemini AI Answer\n\n${msg.text}\n\n`;
                if (msg.sources && msg.sources.length > 0) {
                    md += `#### Grounding Context Chunks\n\n`;
                    msg.sources.forEach((s) => {
                        md += `> **[Source Chunk #${s.id}]**\n> ${s.content.replace(/\n/g, '\n> ')}\n>\n`;
                    });
                    md += `\n`;
                }
                md += `---\n\n`;
            }
        });

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeDocName = title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        link.download = `${safeDocName}_analysis.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="chat-section">
            <div className="panel-header">
                <div className="panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Contextual Q&A</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {messages.length > 0 && !isLoading && !isStreaming && (
                        <>
                            <button
                                type="button"
                                className="export-chat-btn"
                                onClick={handleExportChat}
                                title="Export conversation as Markdown"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Export</span>
                            </button>
                            <button
                                type="button"
                                className="clear-chat-btn"
                                onClick={handleClearChat}
                                title="Clear conversation history"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                <span>Clear</span>
                            </button>
                        </>
                    )}
                    <span className="step-indicator">STEP 2</span>
                </div>
            </div>

            {/* Active Document Context Pill */}
            {isFileProcessed && activeDocName && (
                <div className="active-doc-banner">
                    <span className="active-doc-dot"></span>
                    <span className="active-doc-label">Active Context:</span>
                    <span className="active-doc-name" title={activeDocName}>{activeDocName}</span>
                </div>
            )}
            
            {/* Chat Window with Floating Jump to Latest Button */}
            <div className="chat-window-container">
                <div className="chat-window" ref={chatWindowRef} onScroll={handleScroll}>
                    {messages.length === 0 ? (
                        <div className="chat-empty-state">
                            <div className="chat-empty-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                            </div>
                            <p>
                                {isFileProcessed 
                                    ? "Document indexed! Ask any question or select a suggestion chip below to explore." 
                                    : "Upload and process a PDF on the left to start exploring its contents."}
                            </p>

                            {/* Quick Prompts in Empty State */}
                            {isFileProcessed && !isLoading && !isStreaming && (
                                <div className="empty-state-chips">
                                    {SUGGESTIONS.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="suggestion-chip"
                                            onClick={() => sendQuestion(item.prompt)}
                                        >
                                            <span className="chip-icon">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div key={index} className={`message-row ${msg.role}`}>
                                {msg.role === 'ai' && (
                                    <div className="avatar-badge" title="Gemini AI">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 1C12 7.075 16.925 12 23 12C16.925 12 12 16.925 12 23C12 16.925 7.075 12 1 12C7.075 12 12 7.075 12 1Z" />
                                        </svg>
                                    </div>
                                )}

                                <div className={`message-bubble ${msg.role}`}>
                                    {msg.role === 'ai' ? (
                                        <>
                                            <div className="markdown-body">
                                                <ReactMarkdown>{msg.text || " "}</ReactMarkdown>
                                                {msg.streaming && <span className="streaming-cursor">▋</span>}
                                            </div>

                                            {/* Grounding Source Context Accordion */}
                                            {!msg.streaming && msg.sources && msg.sources.length > 0 && (
                                                <details className="source-accordion">
                                                    <summary className="source-summary">
                                                        <span className="source-summary-left">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                <polyline points="10 9 9 9 8 9"></polyline>
                                                            </svg>
                                                            <span>{msg.sources.length} Context Sources</span>
                                                        </span>
                                                        <svg className="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="6 9 12 15 18 9"></polyline>
                                                        </svg>
                                                    </summary>
                                                    <div className="source-content-list">
                                                        {msg.sources.map((src) => (
                                                            <div key={src.id} className="source-chunk-card">
                                                                <div className="source-chunk-tag">
                                                                    <span>Retrieved Chunk #{src.id}</span>
                                                                </div>
                                                                <p className="source-chunk-text">"{src.content}"</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </>
                                    ) : (
                                        msg.text
                                    )}

                                    {/* Copy Button for AI Messages (visible when not streaming) */}
                                    {msg.role === 'ai' && !msg.streaming && (
                                        <div className="bubble-actions">
                                            <button
                                                type="button"
                                                className="copy-btn"
                                                onClick={() => handleCopy(msg.text, index)}
                                                title="Copy response"
                                                aria-label="Copy response"
                                            >
                                                {copiedIndex === index ? (
                                                    <>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                        <span className="copied-label">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                        </svg>
                                                        <span>Copy</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    
                    {isLoading && (
                        <div className="typing-box">
                            <div className="avatar-badge" title="Gemini AI">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 1C12 7.075 16.925 12 23 12C16.925 12 12 16.925 12 23C12 16.925 7.075 12 1 12C7.075 12 12 7.075 12 1Z" />
                                </svg>
                            </div>
                            <div className="typing-bubble">
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                            </div>
                        </div>
                    )}
                    
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Floating "Jump to latest" button */}
                {showScrollBottom && (
                    <button
                        type="button"
                        className="jump-bottom-btn"
                        onClick={scrollToBottom}
                        aria-label="Jump to latest message"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <span>Jump to latest</span>
                    </button>
                )}
            </div>

            {/* Quick Suggestion Chips Bar when conversation is active */}
            {isFileProcessed && messages.length > 0 && !isLoading && !isStreaming && (
                <div className="suggestion-chips-bar">
                    {SUGGESTIONS.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="suggestion-chip"
                            onClick={() => sendQuestion(item.prompt)}
                            title={item.prompt}
                        >
                            <span className="chip-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            )}
            
            {/* Auto-expanding input area with hidden scrollbar and keyboard support */}
            <form onSubmit={(e) => { e.preventDefault(); sendQuestion(); }} className="chat-input-area">
                <div className="chat-input-wrapper">
                    <textarea 
                        ref={textareaRef}
                        rows={1}
                        className="chat-textarea"
                        placeholder={isFileProcessed ? "Ask a question about the document..." : "Upload a document first..."} 
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading || isStreaming || !isFileProcessed}
                    />
                </div>
                <button 
                    type="submit" 
                    className="chat-send-btn"
                    disabled={isLoading || isStreaming || !input.trim() || !isFileProcessed}
                    aria-label="Send query"
                >
                    {isLoading ? (
                        <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                        </svg>
                    ) : (
                        <>
                            <span>Send</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
