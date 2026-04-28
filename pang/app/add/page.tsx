"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Camera, Upload, FileText, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtworkScanner } from "@/components/artwork-scanner";

type Step = "method" | "capture" | "details" | "documents" | "review";

export default function AddArtworkPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("method");
  const [artworkImage, setArtworkImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [details, setDetails] = useState({
    title: "",
    artist: "",
    year: new Date().getFullYear().toString(),
    medium: "",
    dimensions: "",
    description: "",
  });

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setArtworkImage(e.target?.result as string);
        setStep("capture");
        setIsAnalyzing(true);
        setTimeout(() => {
          setIsAnalyzing(false);
          setDetails({
            title: "Untitled Work",
            artist: "",
            year: new Date().getFullYear().toString(),
            medium: "Mixed media",
            dimensions: "",
            description: "",
          });
        }, 2000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScannerCapture = (imageData: string) => {
    setArtworkImage(imageData);
    setStep("capture");
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setDetails({
        title: "Untitled Work",
        artist: "",
        year: new Date().getFullYear().toString(),
        medium: "Mixed media",
        dimensions: "",
        description: "",
      });
    }, 2000);
  };

  const handleSave = () => {
    router.push("/collection");
  };

  return (
    <main className="min-h-dvh bg-background safe-area-inset-top">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 pt-12 border-b border-border">
        <button onClick={() => router.back()} className="p-2 -m-2">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-medium">add artwork</h1>
          <p className="text-xs text-muted-foreground">
            {step === "method" && "choose how to add"}
            {step === "capture" && "capture your artwork"}
            {step === "details" && "add details"}
            {step === "documents" && "attach documents"}
            {step === "review" && "review & save"}
          </p>
        </div>
      </header>

      {/* Step indicator */}
      <div className="flex gap-1 p-4">
        {(["method", "capture", "details", "documents", "review"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= ["method", "capture", "details", "documents", "review"].indexOf(step)
                ? "bg-accent"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Method Selection */}
      {step === "method" && (
        <div className="p-4 space-y-4">
          <p className="text-muted-foreground text-sm mb-6">
            Capture or upload your artwork. Our AI will help identify details automatically.
          </p>

          {/* Camera capture with smart scanner */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="w-full bg-accent text-accent-foreground rounded-2xl p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-14 h-14 bg-accent-foreground/10 rounded-full flex items-center justify-center">
              <Camera size={24} />
            </div>
            <div>
              <h3 className="font-semibold">scan artwork</h3>
              <p className="text-sm opacity-80">use camera with smart framing</p>
            </div>
          </button>

          {/* Upload from gallery */}
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageCapture}
              className="hidden"
            />
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center">
                <Upload size={24} className="text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">upload image</h3>
                <p className="text-sm text-muted-foreground">choose from your photo library</p>
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Capture/Preview */}
      {step === "capture" && artworkImage && (
        <div className="p-4">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted mb-6">
            <img src={artworkImage} alt="Captured artwork" className="w-full h-full object-cover" />
            
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Sparkles size={28} className="text-accent-foreground" />
                </div>
                <p className="text-white font-medium">analyzing artwork...</p>
                <p className="text-white/60 text-sm mt-1">identifying details with AI</p>
              </div>
            )}
          </div>

          {!isAnalyzing && (
            <>
              <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-accent" />
                  <span className="text-sm font-medium text-accent">AI detected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve pre-filled some details based on image analysis. Review and edit as needed.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("method")}
                  className="flex-1 py-3 bg-muted rounded-full font-medium text-sm"
                >
                  retake
                </button>
                <button
                  onClick={() => setStep("details")}
                  className="flex-1 py-3 bg-accent text-accent-foreground rounded-full font-medium text-sm"
                >
                  continue
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Details Form */}
      {step === "details" && (
        <div className="p-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Title
              </label>
              <input
                type="text"
                value={details.title}
                onChange={(e) => setDetails({ ...details, title: e.target.value })}
                placeholder="Untitled"
                className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Artist
              </label>
              <input
                type="text"
                value={details.artist}
                onChange={(e) => setDetails({ ...details, artist: e.target.value })}
                placeholder="Artist name"
                className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Year
                </label>
                <input
                  type="text"
                  value={details.year}
                  onChange={(e) => setDetails({ ...details, year: e.target.value })}
                  placeholder="2024"
                  className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Medium
                </label>
                <input
                  type="text"
                  value={details.medium}
                  onChange={(e) => setDetails({ ...details, medium: e.target.value })}
                  placeholder="Oil on canvas"
                  className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Dimensions
              </label>
              <input
                type="text"
                value={details.dimensions}
                onChange={(e) => setDetails({ ...details, dimensions: e.target.value })}
                placeholder="100 × 80 cm"
                className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={details.description}
                onChange={(e) => setDetails({ ...details, description: e.target.value })}
                placeholder="Add notes about this work..."
                rows={4}
                className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setStep("capture")}
              className="flex-1 py-3 bg-muted rounded-full font-medium text-sm"
            >
              back
            </button>
            <button
              onClick={() => setStep("documents")}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-full font-medium text-sm"
            >
              continue
            </button>
          </div>
        </div>
      )}

      {/* Documents */}
      {step === "documents" && (
        <div className="p-4">
          <p className="text-muted-foreground text-sm mb-6">
            Add invoices, certificates, or condition reports. You can always add more later.
          </p>

          <div className="space-y-3 mb-8">
            <DocumentUpload icon={FileText} label="Invoice / Receipt" />
            <DocumentUpload icon={FileText} label="Certificate of Authenticity" />
            <DocumentUpload icon={FileText} label="Condition Report" />
            <DocumentUpload icon={FileText} label="Artist Statement" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("details")}
              className="flex-1 py-3 bg-muted rounded-full font-medium text-sm"
            >
              back
            </button>
            <button
              onClick={() => setStep("review")}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-full font-medium text-sm"
            >
              continue
            </button>
          </div>

          <button
            onClick={() => setStep("review")}
            className="w-full mt-4 py-3 text-muted-foreground text-sm"
          >
            skip for now
          </button>
        </div>
      )}

      {/* Review */}
      {step === "review" && (
        <div className="p-4">
          {artworkImage && (
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted mb-6">
              <img src={artworkImage} alt="Artwork" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-medium lowercase">{details.title || "Untitled"}</h2>
            <p className="text-accent font-medium">{details.artist || "Unknown artist"}</p>
            {details.year && <p className="text-muted-foreground text-sm mt-1">{details.year}</p>}
            
            <div className="mt-4 pt-4 border-t border-border space-y-1">
              {details.medium && <p className="text-sm text-muted-foreground">{details.medium}</p>}
              {details.dimensions && <p className="text-sm text-muted-foreground">{details.dimensions}</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("documents")}
              className="flex-1 py-3 bg-muted rounded-full font-medium text-sm"
            >
              back
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-full font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Check size={18} />
              add to collection
            </button>
          </div>
        </div>
      )}

      {/* Artwork Scanner */}
      <ArtworkScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCapture={handleScannerCapture}
      />
    </main>
  );
}

function DocumentUpload({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  const [uploaded, setUploaded] = useState(false);

  return (
    <label className="block">
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={() => setUploaded(true)}
        className="hidden"
      />
      <div
        className={cn(
          "border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-colors",
          uploaded ? "bg-accent/10 border-accent" : "bg-card border-border"
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            uploaded ? "bg-accent" : "bg-muted"
          )}
        >
          {uploaded ? (
            <Check size={18} className="text-accent-foreground" />
          ) : (
            <Icon size={18} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {uploaded ? "Document added" : "Tap to upload"}
          </p>
        </div>
      </div>
    </label>
  );
}
