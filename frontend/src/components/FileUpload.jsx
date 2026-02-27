import { useState, useRef } from 'react';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Component for handling drag-and-drop PDF uploads and submission.
 * Validates file type and size before sending the document to the backend API.
 *
 * @param {Object} props
 * @param {boolean} props.isFileProcessed - Indicates if a document is currently loaded in the backend.
 * @param {Function} props.onProcessSuccess - Callback triggered when the backend successfully processes the upload.
 * @returns {JSX.Element} The rendered FileUploader component.
 */
export default function FileUploader({ isFileProcessed, onProcessSuccess }) {
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOver, setIsOver] = useState(false);
    const [toastMessage, setToastMessage] = useState(null); 
    
    const fileInputRef = useRef(null);

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
            setError(`File is too large! Max limit is ${MAX_FILE_SIZE_MB}MB.`);
            return;
        }

        if (selectedFile && selectedFile.type !== "application/pdf") {
            setError("Please upload a PDF file.");
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
     * Submits the validated file to the backend processing API.
     */
    const handleProcess = async () => {
        setIsProcessing(true);
        
        const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("session_id", newSessionId);

            const response = await fetch("https://ai-rag-analyzer-api.onrender.com/upload", {
                method: "POST",
                body: formData,
            });

            if(!response.ok){
                const errorData = await response.json();
                throw new Error(errorData.detail || "Upload Failed");
            }

            // eslint-disable-next-line no-unused-vars
            const data = await response.json();
            
            setToastMessage(`Success! Document processed and ready for chat.`);
            setTimeout(() => setToastMessage(null), 3000); 

            if (onProcessSuccess) {
                onProcessSuccess(newSessionId);
            }

        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message || "Backend processing failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Resets the application state to allow for a new document upload.
     */
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="upload-section" style={{ position: 'relative' }}>
            <h2>1. Upload Document</h2>
            
            {/* Success Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'absolute',
                    top: '-20px', 
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontWeight: '600',
                    zIndex: 1000,
                    whiteSpace: 'nowrap',
                    transition: 'opacity 0.3s ease-in-out'
                }}>
                    {toastMessage}
                </div>
            )}

            {/* Drag and Drop Zone */}
            <div 
                className={`upload-box ${isOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
                onDragLeave={() => setIsOver(false)}
                onDrop={onDrop}
                onClick={() => !isFileProcessed && fileInputRef.current.click()} 
                style={{ cursor: isFileProcessed ? 'not-allowed' : 'pointer', opacity: isFileProcessed ? 0.6 : 1 }}
            >
                <input 
                    type="file" 
                    hidden 
                    ref={fileInputRef} 
                    onChange={(e) => handleFile(e.target.files[0])}
                    accept="application/pdf"
                    className="hidden-input"
                    disabled={isFileProcessed}
                />
                
                {!file ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <label className="upload-label" style={{ cursor: isFileProcessed ? 'not-allowed' : 'pointer' }}>
                            Drag & Drop your PDF here or Click to browse
                        </label>
                        {/* RED DISCLAIMER NOTE */}
                        <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '500' }}>
                            *Please upload digital text PDFs only (no scanned images)
                        </span>
                    </div>
                    
                ) : (
                    <div className="file-info" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                        <span>📄 {file.name} ({formatFileSize(file.size)})</span>
                        {!isFileProcessed && ( 
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeFile(); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red', fontWeight: 'bold' }}
                                aria-label="Remove file"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}
            </div>

            {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '-10px', marginBottom: '10px' }}>{error}</p>}

            {/* Dynamic Action Button based on processing state */}
            {isFileProcessed ? (
                <button 
                    className="process-btn" 
                    onClick={handleRefresh}
                    style={{ backgroundColor: '#ef4444' }} 
                >
                    🔄 Upload New Document
                </button>
            ) : (
                <button 
                    className="process-btn" 
                    onClick={handleProcess} 
                    disabled={!file || isProcessing}
                >
                    {isProcessing ? "Processing..." : "Process Document"}
                </button>
            )}
        </div>
    );
}