import { useState, useRef, useEffect } from 'react';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Component for handling drag-and-drop PDF uploads and submission.
 * Validates file type and size before sending the document to the backend API.
 * Features an accelerating progress curve (starts slow, speeds up toward the finish).
 *
 * @param {Object} props
 * @param {boolean} props.isFileProcessed - Indicates if a document is currently loaded in the backend.
 * @param {Function} props.onProcessSuccess - Callback triggered when the backend successfully processes the upload.
 * @param {Function} [props.onReset] - Callback triggered when the user resets or uploads another document.
 * @returns {JSX.Element} The rendered FileUploader component.
 */
export default function FileUploader({ isFileProcessed, onProcessSuccess, onReset }) {
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOver, setIsOver] = useState(false);
    const [toastMessage, setToastMessage] = useState(null); 
    const [progress, setProgress] = useState(0);
    const [progressStage, setProgressStage] = useState("");
    
    const fileInputRef = useRef(null);
    const progressTimerRef = useRef(null);

    // Clean up timer if component unmounts during upload
    useEffect(() => {
        return () => {
            if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
        };
    }, []);

    /**
     * Converts a file size in bytes to a human-readable string.
     */
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    /**
     * Validates the selected file for size and type constraints.
     */
    const handleFile = (selectedFile) => {
        setError("");
        
        if (selectedFile && selectedFile.size > MAX_FILE_SIZE_BYTES) {
            setError(`File is too large! Maximum limit is ${MAX_FILE_SIZE_MB}MB.`);
            return;
        }

        if (selectedFile && selectedFile.type !== "application/pdf") {
            setError("Please upload a PDF document.");
            return;
        }

        setFile(selectedFile);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsOver(false);
        const droppedFile = e.dataTransfer.files[0];
        handleFile(droppedFile);
    };

    const removeFile = () => {
        setFile(null);
        setError("");
        if (fileInputRef.current) fileInputRef.current.value = ""; 
    };

    /**
     * Resets the document upload state smoothly without full page refresh.
     */
    const handleResetDocument = () => {
        setFile(null);
        setError("");
        setProgress(0);
        setProgressStage("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (onReset) onReset();
    };

    /**
     * Submits the validated file to the backend processing API
     * with an accelerating progress bar (slow initially, accelerates towards completion).
     */
    const handleProcess = async () => {
        setIsProcessing(true);
        setError("");
        
        let currentPercent = 4;
        setProgress(4);
        setProgressStage("Reading and extracting text...");

        // Recursive accelerating progress step
        const stepProgress = () => {
            let increment;
            let delay;

            if (currentPercent < 28) {
                // PHASE 1 (Slow initial crawl): gives the server time for PDF parse & extraction
                increment = Math.random() < 0.65 ? 1 : 2;
                delay = 380;
                setProgressStage("Parsing document pages & extracting text...");
            } else if (currentPercent < 62) {
                // PHASE 2 (Moderate build-up): chunking & embedding generation
                increment = Math.floor(Math.random() * 3) + 3; // +3% to +5%
                delay = 230;
                setProgressStage("Generating 3072-dim vector embeddings...");
            } else if (currentPercent < 94) {
                // PHASE 3 (Fast accelerating finish): rapid progress so user never feels stuck
                increment = Math.floor(Math.random() * 4) + 5; // +5% to +8%
                delay = 140;
                setProgressStage("Upserting vectors to Pinecone namespace...");
            } else {
                // PHASE 4 (Final holding glide near the top)
                increment = 0.5;
                delay = 400;
                setProgressStage("Finalizing vector index...");
            }

            currentPercent = Math.min(97, currentPercent + increment);
            setProgress(Math.floor(currentPercent));

            if (currentPercent < 97) {
                progressTimerRef.current = setTimeout(stepProgress, delay);
            }
        };

        // Kick off progress step
        progressTimerRef.current = setTimeout(stepProgress, 300);

        const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("session_id", newSessionId);

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/upload`, {
                method: "POST",
                body: formData,
            });

            if(!response.ok){
                const errorData = await response.json();
                throw new Error(errorData.detail || "Upload Failed");
            }

            const data = await response.json();
            
            // Instantly snap to 100% on success
            if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
            setProgress(100);
            setProgressStage("Document indexed successfully!");

            setTimeout(() => {
                setToastMessage("Document processed and ready for chat");
                setTimeout(() => setToastMessage(null), 3500); 
                setIsProcessing(false);

                if (onProcessSuccess) {
                    onProcessSuccess(newSessionId, file ? file.name : (data.filename || "Uploaded Document"));
                }
            }, 550);

        } catch (err) {
            console.error("Upload error:", err);
            if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
            setProgress(0);
            setIsProcessing(false);
            setError(err.message || "Backend processing failed.");
        }
    };

    return (
        <div className="upload-section">
            <div className="panel-header">
                <div className="panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                    <span>Upload Document</span>
                </div>
                <span className="step-indicator">STEP 1</span>
            </div>
            
            {/* Success Toast Notification */}
            {toastMessage && (
                <div className="toast-notification">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Drag and Drop Zone */}
            <div 
                className={`upload-box ${isOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
                onDragLeave={() => setIsOver(false)}
                onDrop={onDrop}
                onClick={() => !isFileProcessed && !isProcessing && fileInputRef.current.click()} 
                style={{ cursor: (isFileProcessed || isProcessing) ? 'not-allowed' : 'pointer', opacity: isFileProcessed ? 0.7 : 1 }}
            >
                <input 
                    type="file" 
                    hidden 
                    ref={fileInputRef} 
                    onChange={(e) => handleFile(e.target.files[0])}
                    accept="application/pdf"
                    className="hidden-input"
                    disabled={isFileProcessed || isProcessing}
                />
                
                {!file ? (
                    <>
                        <div className="upload-icon-wrapper">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                        </div>
                        <p className="upload-primary-text">
                            Drag & drop your PDF here or browse
                        </p>
                        <p className="upload-sub-text">Supports digital text PDFs up to 5MB</p>
                        <span className="upload-disclaimer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            Digital text PDFs only (no scanned images)
                        </span>
                    </>
                ) : (
                    <div className="file-card">
                        <div className="file-card-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                        <div className="file-card-details">
                            <div className="file-card-name" title={file.name}>{file.name}</div>
                            <div className="file-card-size">{formatFileSize(file.size)}</div>
                        </div>
                        {!isFileProcessed && !isProcessing && ( 
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeFile(); }}
                                className="file-remove-btn"
                                aria-label="Remove file"
                                title="Remove file"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Accelerating Progress Bar during vectorization */}
            {isProcessing && (
                <div className="progress-container">
                    <div className="progress-header">
                        <span className="progress-stage">
                            <svg className="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                            </svg>
                            {progressStage}
                        </span>
                        <span className="progress-percentage">{progress}%</span>
                    </div>
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-text">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {/* Dynamic Action Button based on processing state */}
            {isFileProcessed ? (
                <button 
                    className="process-btn reset-mode" 
                    onClick={handleResetDocument}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>Upload Another Document</span>
                </button>
            ) : (
                <button 
                    className={`process-btn ${isProcessing ? 'processing' : ''}`} 
                    onClick={handleProcess} 
                    disabled={!file || isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                            </svg>
                            <span>Vectorizing Document...</span>
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14"></path>
                                <path d="m12 5 7 7-7 7"></path>
                            </svg>
                            <span>Process Document</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
