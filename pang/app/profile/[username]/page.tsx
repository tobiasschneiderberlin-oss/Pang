"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Instagram, Linkedin, Phone, Mail, Eye, EyeOff, Camera, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { artworks } from "@/lib/data";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

interface ContactField {
  value: string;
  visible: boolean;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { username } = use(params);
  const router = useRouter();
  
  // Profile state
  const [userName, setUserName] = useState("Collector");
  const [location, setLocation] = useState("");
  const [collectingSince, setCollectingSince] = useState(2019);
  const [instagram, setInstagram] = useState<ContactField>({ value: "", visible: true });
  const [linkedin, setLinkedin] = useState<ContactField>({ value: "", visible: true });
  const [phone, setPhone] = useState<ContactField>({ value: "", visible: false });
  const [email, setEmail] = useState<ContactField>({ value: "", visible: false });
  
  // Profile picture state
  const [profilePicType, setProfilePicType] = useState<'initials' | 'artwork' | 'custom'>('initials');
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [showArtworkPicker, setShowArtworkPicker] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  


  // Load saved profile data
  useEffect(() => {
    const saved = localStorage.getItem("pang-collector-profile");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLocation(data.location || "");
        setInstagram(data.instagram || { value: "", visible: true });
        setLinkedin(data.linkedin || { value: "", visible: true });
        setPhone(data.phone || { value: "", visible: false });
        setEmail(data.email || { value: "", visible: false });
        setProfilePicType(data.profilePicType || 'initials');
        setSelectedArtworkId(data.selectedArtworkId || null);
        setCustomImageUrl(data.customImageUrl || null);
      } catch (e) {
        console.error("Failed to load profile data", e);
      }
    }

    const stored = localStorage.getItem("pang-user-name");
    if (stored) setUserName(stored);
    
    const sinceStored = localStorage.getItem("pang-collecting-since");
    if (sinceStored) setCollectingSince(parseInt(sinceStored));
    
    setHasLoaded(true);
  }, []);

  // Auto-save whenever any field changes (only after initial load)
  useEffect(() => {
    if (!hasLoaded) return;
    
    const profileData = {
      location,
      instagram,
      linkedin,
      phone,
      email,
      profilePicType,
      selectedArtworkId,
      customImageUrl,
    };
    localStorage.setItem("pang-collector-profile", JSON.stringify(profileData));
    localStorage.setItem("pang-user-name", userName);
    localStorage.setItem("pang-collecting-since", collectingSince.toString());
  }, [hasLoaded, location, instagram, linkedin, phone, email, profilePicType, selectedArtworkId, customImageUrl, userName, collectingSince]);

  // Get initials
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  // Get selected artwork for profile pic
  const selectedArtwork = selectedArtworkId ? artworks.find(a => a.id === selectedArtworkId) : null;

  // Calculate stats
  const worksCount = artworks.length;
  const artistsCount = new Set(artworks.map(a => a.artistId)).size;

  // Render profile picture
  const renderProfilePic = (size: 'small' | 'large' = 'large') => {
    const sizeClass = size === 'large' ? 'w-20 h-20' : 'w-14 h-14';
    const textSize = size === 'large' ? 'text-2xl' : 'text-lg';
    
    if (profilePicType === 'artwork' && selectedArtwork) {
      return (
        <div className={cn(sizeClass, "rounded-full overflow-hidden flex-shrink-0")}>
          <Image
            src={selectedArtwork.imageUrl}
            alt="Profile"
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    
    if (profilePicType === 'custom' && customImageUrl) {
      return (
        <div className={cn(sizeClass, "rounded-full overflow-hidden flex-shrink-0")}>
          <Image
            src={customImageUrl}
            alt="Profile"
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    
    return (
      <div className={cn(sizeClass, "bg-accent rounded-full flex items-center justify-center flex-shrink-0")}>
        <span className={cn(textSize, "font-semibold text-accent-foreground")}>{initials}</span>
      </div>
    );
  };

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors -ml-2"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-semibold">Profile</h1>
        </div>
      </header>

      <div className="px-4 py-4 pb-20">
        {/* Preview Card - How others see you */}
        <section className="mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">How others see you</p>
          <div className="bg-card border border-border/30 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              {renderProfilePic('large')}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{userName}</h3>
                {location && (
                  <p className="text-sm text-muted-foreground">{location}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  Collecting since {collectingSince}
                </p>
                
                {/* Stats */}
                <p className="text-sm text-muted-foreground mt-2">
                  {worksCount} works · {artistsCount} artists
                </p>
                
                {/* Contact icons */}
                <div className="flex gap-2 mt-3">
                  {instagram.visible && instagram.value && (
                    <span className="p-1.5 bg-muted rounded-full">
                      <Instagram size={14} className="text-foreground" />
                    </span>
                  )}
                  {linkedin.visible && linkedin.value && (
                    <span className="p-1.5 bg-muted rounded-full">
                      <Linkedin size={14} className="text-foreground" />
                    </span>
                  )}
                  {email.visible && email.value && (
                    <span className="p-1.5 bg-muted rounded-full">
                      <Mail size={14} className="text-foreground" />
                    </span>
                  )}
                  {phone.visible && phone.value && (
                    <span className="p-1.5 bg-muted rounded-full">
                      <Phone size={14} className="text-foreground" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Picture Selection */}
        <section className="mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Profile Picture</p>
          <div className="flex gap-3">
            <button
              onClick={() => setProfilePicType('initials')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2",
                profilePicType === 'initials' 
                  ? "border-accent bg-accent/10 text-accent" 
                  : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              <span className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center text-xs">{initials}</span>
              Initials
            </button>
            <button
              onClick={() => setShowArtworkPicker(true)}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2",
                profilePicType === 'artwork' 
                  ? "border-accent bg-accent/10 text-accent" 
                  : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              <ImageIcon size={16} />
              Artwork
            </button>
            <button
              onClick={() => {
                // In a real app, this would open file picker
                setProfilePicType('custom');
              }}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2",
                profilePicType === 'custom' 
                  ? "border-accent bg-accent/10 text-accent" 
                  : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              <Camera size={16} />
              Photo
            </button>
          </div>
        </section>

        {/* Name */}
        <section className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Name</label>
          <input 
            type="text" 
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </section>

        {/* Location */}
        <section className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Location</label>
          <input 
            type="text" 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Berlin"
            className="w-full bg-muted/30 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </section>

        {/* Contact Methods */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Contact Methods</h2>
          
          <div className="space-y-3">
            <ContactFieldInput
              icon={<Instagram size={18} />}
              value={instagram.value}
              visible={instagram.visible}
              onValueChange={(v) => setInstagram({ ...instagram, value: v })}
              onVisibilityChange={(v) => setInstagram({ ...instagram, visible: v })}
              placeholder="@handle"
            />

            <ContactFieldInput
              icon={<Linkedin size={18} />}
              value={linkedin.value}
              visible={linkedin.visible}
              onValueChange={(v) => setLinkedin({ ...linkedin, value: v })}
              onVisibilityChange={(v) => setLinkedin({ ...linkedin, visible: v })}
              placeholder="profile"
            />

            <ContactFieldInput
              icon={<Mail size={18} />}
              value={email.value}
              visible={email.visible}
              onValueChange={(v) => setEmail({ ...email, value: v })}
              onVisibilityChange={(v) => setEmail({ ...email, visible: v })}
              placeholder="your@email.com"
            />

            <ContactFieldInput
              icon={<Phone size={18} />}
              value={phone.value}
              visible={phone.visible}
              onValueChange={(v) => setPhone({ ...phone, value: v })}
              onVisibilityChange={(v) => setPhone({ ...phone, visible: v })}
              placeholder="+49..."
            />
          </div>
        </section>

      </div>

      {/* Artwork Picker Modal */}
      {showArtworkPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-background w-full rounded-t-3xl max-h-[70vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Choose an artwork</h3>
              <button 
                onClick={() => setShowArtworkPicker(false)}
                className="text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-3 gap-3">
                {artworks.map((artwork) => (
                  <button
                    key={artwork.id}
                    onClick={() => {
                      setSelectedArtworkId(artwork.id);
                      setProfilePicType('artwork');
                      setShowArtworkPicker(false);
                    }}
                    className={cn(
                      "aspect-square rounded-xl overflow-hidden border-2 transition-colors",
                      selectedArtworkId === artwork.id ? "border-accent" : "border-transparent"
                    )}
                  >
                    <Image
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ContactFieldInput({
  icon,
  value,
  visible,
  onValueChange,
  onVisibilityChange,
  placeholder,
}: {
  icon: React.ReactNode;
  value: string;
  visible: boolean;
  onValueChange: (value: string) => void;
  onVisibilityChange: (visible: boolean) => void;
  placeholder: string;
}) {
  return (
    <div className="bg-muted/30 rounded-xl p-3 flex items-center gap-3">
      <div className="text-muted-foreground flex-shrink-0">{icon}</div>
      
      <input 
        type="text" 
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-w-0"
      />
      
      <button 
        onClick={() => onVisibilityChange(!visible)}
        className={cn(
          "p-1.5 rounded-full transition-colors flex-shrink-0",
          visible ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
        )}
        title={visible ? "Visible to collectors" : "Hidden from collectors"}
      >
        {visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  );
}
