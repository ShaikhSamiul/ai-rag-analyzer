import { useState } from 'react';
import './App.css';
import FileUploader from './components/FileUpload';
import ChatInterface from './components/ChatInterface';

/**
 * Root application component for the AI Document Analyzer.
 * Manages the global state for document processing and orchestrates
 * the interaction between the file upload and chat interfaces.
 *
 * @returns {JSX.Element} The rendered App layout.
 */
export default function App() {
  // Tracks the lifecycle of the uploaded document to synchronize child components
  const [isFileProcessed, setIsFileProcessed] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [activeDocName, setActiveDocName] = useState("");

  const handleProcessSuccess = (newSessionId, docName) => {
    setSessionId(newSessionId);
    if (docName) setActiveDocName(docName);
    setIsFileProcessed(true);
  };

  const handleReset = () => {
    setIsFileProcessed(false);
    setSessionId("");
    setActiveDocName("");
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>AI Document Analyzer</h1>
        <p>Upload any PDF document to analyze, extract context, and converse in real-time.</p>
      </header>
      
      <main className="main-content">
        <FileUploader 
          isFileProcessed={isFileProcessed} 
          onProcessSuccess={handleProcessSuccess} 
          onReset={handleReset}
        />

        <ChatInterface 
          isFileProcessed={isFileProcessed} 
          sessionId={sessionId}
          activeDocName={activeDocName}
        />
      </main>
    </div>
  );
}
