"use client";

import { useState, useCallback } from "react";
import { X, FileText, Sparkles, Check, Link2, ChevronRight, AlertCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { artworks, type Artwork, type ArtworkDocument } from "@/lib/api";

interface ScannedDocument {
  id: string;
  fileName: string;
  fileType: string;
  preview?: string;
  detectedType?: ArtworkDocument['type'];
  suggestedArtwork?: Artwork;
  confidence?: number;
  extractedText?: string[];
}

interface DocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (documents: ScannedDocument[]) => void;
}

export function DocumentScanner({ isOpen, onClose, onComplete }: DocumentScannerProps) {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Handle file drop/upload
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const newDocs: ScannedDocument[] = [];
    
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = file.type.startsWith('image/') ? e.target?.result as string : undefined;
        
        newDocs.push({
          id: `doc-${Date.now()}-${index}`,
          fileName: file.name,
          fileType: file.type,
          preview,
        });

        if (newDocs.length === files.length) {
          setDocuments(prev => [...prev, ...newDocs]);
          // Start AI analysis
          analyzeDocuments(newDocs);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Simulate AI document analysis
  const analyzeDocuments = async (docs: ScannedDocument[]) => {
    setIsAnalyzing(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate AI detection
    const analyzed = docs.map(doc => {
      const fileName = doc.fileName.toLowerCase();
      
      // Detect document type based on filename
      let detectedType: ArtworkDocument['type'] = 'other';
      if (fileName.includes('invoice') || fileName.includes('receipt')) {
        detectedType = 'invoice';
      } else if (fileName.includes('certificate') || fileName.includes('auth')) {
        detectedType = 'certificate';
      } else if (fileName.includes('condition') || fileName.includes('report')) {
        detectedType = 'condition-report';
      } else if (fileName.includes('appraisal') || fileName.includes('valuation')) {
        detectedType = 'appraisal';
      } else if (fileName.includes('insurance')) {
        detectedType = 'insurance';
      }

      // Randomly assign to an artwork for demo
      const suggestedArtwork = artworks[Math.floor(Math.random() * artworks.length)];
      
      return {
        ...doc,
        detectedType,
        suggestedArtwork,
        confidence: 75 + Math.floor(Math.random() * 20),
        extractedText: [
          `Artist: ${suggestedArtwork.artistName}`,
          `Title: ${suggestedArtwork.title}`,
          `Date: ${new Date().toLocaleDateString()}`,
        ],
      };
    });

    setDocuments(prev => 
      prev.map(d => analyzed.find(a => a.id === d.id) || d)
    );
    setIsAnalyzing(false);
    setAnalysisComplete(true);
  };

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Confirm and save
  const handleConfirm = () => {
    onComplete(documents);
    onClose();
    setDocuments([]);
    setAnalysisComplete(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 pt-12 border-b border-border safe-area-inset-top">
        <button onClick={onClose} className="p-2 -m-2">
          <X size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-medium">add documents</h1>
          <p className="text-xs text-muted-foreground">
            AI will sort and link to artworks
          </p>
        </div>
      </header>

      <div className="p-4 pb-32 overflow-auto h-[calc(100vh-80px)]">
        {/* Drop zone */}
        {documents.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border rounded-2xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">Drop documents here</h3>
            <p className="text-sm text-muted-foreground mb-4">
              or tap to browse files
            </p>
            <label>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.heic"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <span className="inline-block px-6 py-2 bg-accent text-accent-foreground rounded-full text-sm font-medium cursor-pointer">
                browse files
              </span>
            </label>
          </div>
        )}

        {/* Analyzing state */}
        {isAnalyzing && (
          <div className="mt-8 text-center">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Sparkles size={32} className="text-accent-foreground" />
            </div>
            <h3 className="font-medium">Analyzing documents...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Detecting types and matching to artworks
            </p>
          </div>
        )}

        {/* Document list with AI suggestions */}
        {documents.length > 0 && !isAnalyzing && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Check size={16} className="text-accent" />
              <span className="text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? 's' : ''} analyzed
              </span>
            </div>

            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}

            {/* Add more */}
            <label className="block">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.heic"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <span className="text-sm text-muted-foreground">+ add more documents</span>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Bottom action */}
      {analysisComplete && documents.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-area-inset-bottom">
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Check size={18} />
            save {documents.length} document{documents.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentCard({ document }: { document: ScannedDocument }) {
  const typeLabels: Record<ArtworkDocument['type'], string> = {
    certificate: 'Certificate of Authenticity',
    invoice: 'Invoice / Receipt',
    'condition-report': 'Condition Report',
    appraisal: 'Appraisal',
    insurance: 'Insurance Document',
    other: 'Other Document',
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      {/* Document header */}
      <div className="flex items-start gap-3 mb-3">
        {document.preview ? (
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            <img src={document.preview} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <FileText size={24} className="text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{document.fileName}</p>
          {document.detectedType && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
              {typeLabels[document.detectedType]}
            </span>
          )}
        </div>
      </div>

      {/* AI suggestion */}
      {document.suggestedArtwork && (
        <div className="bg-muted rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs font-medium">AI suggested link</span>
            {document.confidence && (
              <span className="text-xs text-muted-foreground ml-auto">{document.confidence}% match</span>
            )}
          </div>
          <button className="w-full flex items-center gap-3 text-left">
            <Link2 size={14} className="text-accent flex-shrink-0" />
            <span className="text-sm truncate">{document.suggestedArtwork.title}</span>
            <span className="text-xs text-muted-foreground truncate">
              by {document.suggestedArtwork.artistName}
            </span>
            <ChevronRight size={14} className="text-muted-foreground ml-auto flex-shrink-0" />
          </button>
        </div>
      )}

      {/* Extracted text preview */}
      {document.extractedText && document.extractedText.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Detected info:</p>
          <div className="flex flex-wrap gap-1">
            {document.extractedText.map((text, i) => (
              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                {text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
