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

  return (
    <div className="app-container">
      <header className="header">
        <h1>AI Document Analyzer</h1>
        <p>Upload a PDF and ask questions about its content.</p>
      </header>
      
      <main className="main-content">
        <FileUploader 
            isFileProcessed={isFileProcessed} 
            onProcessSuccess={() => setIsFileProcessed(true)} 
        />

        <ChatInterface 
            isFileProcessed={isFileProcessed} 
        />
      </main>
    </div>
  );
}