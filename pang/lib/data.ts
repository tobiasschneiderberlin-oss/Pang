// Real artworks from Galerie Droste - https://www.galeriedroste.com/

export interface ArtistMedia {
  type: 'voice-note' | 'video' | 'photo';
  url: string;
  title: string;
  duration?: string; // for audio/video
  thumbnail?: string; // for video
}

export interface ArtistMessage {
  text: string;
  date: string;
  type: 'personal' | 'about-work';
  artworkId?: string; // if message is about specific artwork
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  nationality: string;
  birthYear: number;
  imageUrl?: string;
  // NEW: Artist enrichment
  studioPhotos?: string[];
  voiceNotes?: ArtistMedia[];
  videos?: ArtistMedia[];
  personalMessages?: ArtistMessage[];
  website?: string;
  instagram?: string;
}

export interface CollectorContact {
  instagram?: string;
  linkedin?: string;
  phone?: string;
  email?: string;
}

export interface Collector {
  id: string;
  name: string;
  initials: string;
  location?: string;
  collectingSince: number;
  worksCount: number;
  artistsCount: number;
  contact?: CollectorContact;
}

export interface ProvenanceEntry {
  date: string;
  event: string;
  location?: string;
  photos?: string[]; // NEW: photos of where it hung, installation shots
}

export interface ArtworkDocument {
  id: string;
  type: 'certificate' | 'invoice' | 'condition-report' | 'appraisal' | 'insurance' | 'other';
  title: string;
  date?: string;
  fileUrl?: string;
}

export interface Artwork {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  year: number;
  medium: string;
  dimensions: string;
  imageUrl: string;
  price?: string;
  provenance?: ProvenanceEntry[];
  description?: string;
  gradient: 'sage' | 'warm' | 'sunset' | 'pink-purple' | 'lime-dark';
  // NEW: Enhanced fields
  documents?: ArtworkDocument[];
  artistNotes?: ArtistMessage[]; // personal notes from artist about this work
  installationPhotos?: string[]; // photos of artwork in collector's space
  visibility?: 'private' | 'shared' | 'public';
  verified?: boolean; // Gallery-confirmed provenance
  verifiedDate?: string; // When gallery verified this work
  movement?: string; // Optional art movement / school for Insights grouping
}

export const artists: Artist[] = [
  {
    id: 'willehad-eilers',
    name: 'Willehad Eilers',
    bio: 'German contemporary artist known for his abstract compositions exploring color and form. His meditative canvases invite contemplation through subtle color shifts and gestural marks.',
    nationality: 'German',
    birthYear: 1981,
    website: 'https://willehadstudio.com',
    instagram: '@willehad.eilers',
    studioPhotos: [
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800',
    ],
    voiceNotes: [
      {
        type: 'voice-note',
        url: '/audio/willehad-intro.mp3',
        title: 'On my creative process',
        duration: '2:34',
      },
    ],
    videos: [
      {
        type: 'video',
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        title: 'Studio visit 2024',
        duration: '8:45',
        thumbnail: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400',
      },
    ],
    personalMessages: [
      {
        text: 'Thank you for welcoming Alt Rosa VI into your collection. This piece holds a special place in my heart - it was created during a period of deep reflection on the subtle transitions we experience in life.',
        date: '2024-03-15',
        type: 'personal',
      },
    ],
  },
  {
    id: 'heiko-zahlmann',
    name: 'Heiko Zahlmann',
    bio: 'German artist working with innovative techniques including embossment on concrete, creating unique sculptural reliefs.',
    nationality: 'German',
    birthYear: 1973,
    instagram: '@heikozahlmann',
    studioPhotos: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    ],
  },
  {
    id: 'tatjana-doll',
    name: 'Tatjana Doll',
    bio: 'Contemporary painter whose work explores themes of speed, movement, and modern iconography through her signature high-gloss lacquer technique.',
    nationality: 'German',
    birthYear: 1970,
    website: 'https://tatjanadoll.de',
    voiceNotes: [
      {
        type: 'voice-note',
        url: '/audio/tatjana-magic-carpet.mp3',
        title: 'About the Magic Carpet series',
        duration: '3:12',
      },
    ],
  },
  {
    id: 'james-jean',
    name: 'James Jean',
    bio: 'Taiwanese-American artist known for his intricate, dreamlike paintings that blend classical techniques with contemporary imagery.',
    nationality: 'American',
    birthYear: 1979,
    website: 'https://jamesjean.com',
    instagram: '@jamesjeanart',
    videos: [
      {
        type: 'video',
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        title: 'Creating Jared - timelapse',
        duration: '4:20',
        thumbnail: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400',
      },
    ],
    personalMessages: [
      {
        text: 'Jared represents a culmination of techniques I developed over years. The circular format creates an endless flow that mirrors the cyclical nature of mythology.',
        date: '2023-11-20',
        type: 'about-work',
        artworkId: 'james-jean-jared',
      },
    ],
  },
  {
    id: 'hilary-pecis',
    name: 'Hilary Pecis',
    bio: 'American painter known for her vibrant still lifes and interior scenes that capture moments of everyday beauty.',
    nationality: 'American',
    birthYear: 1979,
    instagram: '@hilarypecis',
    studioPhotos: [
      'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?w=800',
    ],
  },
  {
    id: 'andrew-schoultz',
    name: 'Andrew Schoultz',
    bio: 'American artist creating intricate works that blend historical imagery with contemporary commentary, questioning cycles of power and conflict.',
    nationality: 'American',
    birthYear: 1975,
    website: 'https://andrewschoultz.com',
    instagram: '@andrewschoultz',
    studioPhotos: [
      'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800',
    ],
  },
  {
    id: 'jesse-mockrin',
    name: 'Jesse Mockrin',
    bio: 'American painter who reinterprets Old Master paintings through a contemporary feminist lens.',
    nationality: 'American',
    birthYear: 1981,
    instagram: '@jessemockrin',
  },
  {
    id: 'asad-faulwell',
    name: 'Asad Faulwell',
    bio: 'American artist whose mixed media works explore cultural identity, history, and the intersection of Eastern and Western aesthetics.',
    nationality: 'American',
    birthYear: 1982,
    website: 'https://asadfaulwell.com',
  },
  {
    id: 'tamara-malcher',
    name: 'Tamara Malcher',
    bio: 'German artist working with acrylic and pastel, creating evocative figurative compositions.',
    nationality: 'German',
    birthYear: 1988,
    instagram: '@tamaramalcher',
  },
  {
    id: 'brian-lotti',
    name: 'Brian Lotti',
    bio: 'American artist and former professional skateboarder, known for contemplative oil paintings capturing quiet moments.',
    nationality: 'American',
    birthYear: 1969,
    personalMessages: [
      {
        text: 'Boat, Park, Shade was painted on a quiet afternoon. I wanted to capture that specific quality of light when the day is winding down.',
        date: '2024-02-10',
        type: 'about-work',
        artworkId: 'brian-lotti-boat-park-shade',
      },
    ],
  },
  {
    id: 'johanna-dumet',
    name: 'Johanna Dumet',
    bio: 'French artist creating expressive oil paintings that explore human connection and everyday scenes.',
    nationality: 'French',
    birthYear: 1985,
  },
  {
    id: 'eve-malherbe',
    name: 'Eve Malherbe',
    bio: 'French artist whose paintings blend natural forms with symbolic narratives.',
    nationality: 'French',
    birthYear: 1986,
  },
];

export const artworks: Artwork[] = [
  {
    id: 'alt-rosa-vi',
    title: 'Alt Rosa VI',
    artistId: 'willehad-eilers',
    artistName: 'Willehad Eilers',
    year: 2024,
    medium: 'Acrylic and ink on canvas',
    dimensions: '160 × 120 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/4f39a0cbdd9787539ca9553122b54110p/galeriedroste-willehad-eilers-alt-rosa-vi.png',
    verified: true,
    verifiedDate: '2024-01-15',
    gradient: 'sage',
    visibility: 'private',
    provenance: [
      { 
        date: '2024', 
        event: 'Acquired from Galerie Droste', 
        location: 'Wuppertal',
        photos: ['https://images.unsplash.com/photo-1577720643272-265f09367456?w=800'],
      },
      { date: '2024', event: 'Created by artist', location: 'Berlin Studio' },
    ],
    description: 'A meditative exploration of soft pink tones and organic forms, this large-scale canvas invites contemplation through its subtle color shifts and gestural marks.',
    documents: [
      { id: 'doc-1', type: 'certificate', title: 'Certificate of Authenticity', date: '2024-03-15' },
      { id: 'doc-2', type: 'invoice', title: 'Purchase Invoice', date: '2024-03-10' },
    ],
    installationPhotos: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    ],
    artistNotes: [
      {
        text: 'Alt Rosa VI is part of a series exploring the color pink as a metaphor for vulnerability and strength. The VI refers to the sixth iteration where I finally achieved the exact tone I was searching for.',
        date: '2024-03-20',
        type: 'about-work',
      },
    ],
  },
  {
    id: 'heiko-zahlmann-untitled',
    title: 'Untitled',
    artistId: 'heiko-zahlmann',
    artistName: 'Heiko Zahlmann',
    year: 2021,
    medium: 'Embossment on concrete',
    dimensions: '72 × 52 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/734b2635c1197dda7c3f46124f836b70j/galeriedroste-heiko-zahlmann-untitled.jpg',
    gradient: 'warm',
    visibility: 'shared',
    verified: true,
    verifiedDate: '2024-02-20',
    provenance: [
      { date: '2024', event: 'Acquired from Galerie Droste', location: 'Wuppertal' },
      { date: '2021', event: 'Created by artist' },
    ],
    description: 'An innovative relief work where pattern meets material, creating a tactile surface that plays with light and shadow.',
    documents: [
      { id: 'doc-3', type: 'certificate', title: 'Certificate of Authenticity', date: '2024-01-20' },
    ],
  },
  {
    id: 'freier-eintritt',
    title: 'Freier Eintritt',
    artistId: 'tatjana-doll',
    artistName: 'Tatjana Doll',
    year: 2001,
    medium: 'Mixed media on canvas',
    dimensions: '50 × 100 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/58b376496201ba04c2fd432443595aebj/galeriedroste-tatjana-doll-freier-eintritt-2001.jpg',
    gradient: 'sunset',
    visibility: 'private',
    provenance: [
      { date: '2023', event: 'Private collection', location: 'Munich' },
      { date: '2001', event: 'Created by artist', location: 'Cologne Studio' },
    ],
    description: 'An early work showcasing Doll\'s exploration of surface and color that would define her later practice.',
  },
  {
    id: 'magic-carpet-2',
    title: 'AD_Magic Carpet 2',
    artistId: 'tatjana-doll',
    artistName: 'Tatjana Doll',
    year: 2011,
    medium: 'Lacquer on canvas',
    dimensions: '150 × 300 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/2e0fdeca2d0a0f8e150c4945f6f9f7b6j/galeriedroste-tatjana-doll-ad_magic-carpet-2-2011.jpg',
    gradient: 'warm',
    visibility: 'public',
    provenance: [
      { 
        date: '2023', 
        event: 'Private collection', 
        location: 'Munich',
        photos: ['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800'],
      },
      { date: '2011', event: 'Galerie Droste exhibition', location: 'Wuppertal' },
      { date: '2011', event: 'Created by artist', location: 'Cologne Studio' },
    ],
    description: 'Doll\'s signature high-gloss lacquer technique creates a surface that seems to vibrate with energy, capturing the essence of speed and movement.',
    documents: [
      { id: 'doc-4', type: 'certificate', title: 'Certificate of Authenticity', date: '2011-06-15' },
      { id: 'doc-5', type: 'condition-report', title: 'Condition Report', date: '2023-09-01' },
      { id: 'doc-6', type: 'appraisal', title: 'Insurance Appraisal', date: '2023-10-15' },
    ],
  },
  {
    id: 'james-jean-jared',
    title: 'Jared',
    artistId: 'james-jean',
    artistName: 'James Jean',
    year: 2012,
    medium: 'Acrylic and oil on canvas mounted wood panel',
    dimensions: 'Diameter: 182.88 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/7bd7cf5215b101c8dcc2a2ae5bc10d73j/galeriedroste-james-jean-jared-2012.jpg',
    gradient: 'pink-purple',
    visibility: 'private',
    verified: true,
    verifiedDate: '2022-11-05',
    provenance: [
      { date: '2022', event: 'Private collection' },
      { date: '2012', event: 'Created by artist', location: 'Los Angeles' },
    ],
    description: 'A stunning circular composition showcasing Jean\'s masterful blend of classical technique and contemporary vision.',
    artistNotes: [
      {
        text: 'Jared represents a culmination of techniques I developed over years. The circular format creates an endless flow that mirrors the cyclical nature of mythology.',
        date: '2023-11-20',
        type: 'about-work',
      },
    ],
  },
  {
    id: 'hilary-pecis-book-stack',
    title: 'Living Room Book Stack',
    artistId: 'hilary-pecis',
    artistName: 'Hilary Pecis',
    year: 2017,
    medium: 'Acrylic on canvas',
    dimensions: '76 × 61 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/6664c69bf7c3fc378ceaf1ba8503c775j/galeriedroste-hilary-pecis-living-room-book-stack-2017.jpg',
    gradient: 'lime-dark',
    visibility: 'shared',
    provenance: [
      { date: '2023', event: 'Private collection' },
      { date: '2017', event: 'Created by artist', location: 'Los Angeles' },
    ],
    description: 'A vibrant still life capturing the intimate details of domestic life through Pecis\'s distinctive colorful palette.',
  },
  {
    id: 'holy-mountain',
    title: 'Holy Mountain',
    artistId: 'andrew-schoultz',
    artistName: 'Andrew Schoultz',
    year: 2019,
    medium: 'Acrylic on canvas',
    dimensions: '203 × 132 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/291a5a23c9023963b3761e2914ae1b7cj/galeriedroste-andrew-schoultz-holy-mountain-2019.jpg',
    gradient: 'sunset',
    visibility: 'private',
    provenance: [
      { date: '2022', event: 'Acquired at Art Basel', location: 'Miami' },
      { date: '2019', event: 'Created by artist', location: 'San Francisco' },
    ],
    description: 'An intricate composition layering historical symbols with contemporary imagery, questioning the cyclical nature of power and conflict.',
  },
  {
    id: 'in-the-glorious-light',
    title: 'In The Glorious Light',
    artistId: 'andrew-schoultz',
    artistName: 'Andrew Schoultz',
    year: 2019,
    medium: 'Acrylic on canvas',
    dimensions: '122 × 122 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/860ea04cdee377dbc799b5eca74901ccj/galeriedroste-andrew-schoultz-in-the-glorious-light-2019.jpg',
    gradient: 'warm',
    visibility: 'private',
    provenance: [
      { date: '2024', event: 'Private collection' },
      { date: '2019', event: 'Created by artist', location: 'San Francisco' },
    ],
    description: 'Light breaks through layers of intricate patterning in this mesmerizing work exploring transformation and hope.',
  },
  {
    id: 'jesse-mockrin-sebastian',
    title: 'Sebastian II',
    artistId: 'jesse-mockrin',
    artistName: 'Jesse Mockrin',
    year: 2020,
    medium: 'Oil on paper',
    dimensions: '30.48 × 22.86 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/38cebec39d3eddb0a4cd3f34bb2b3d68j/galeriedroste-jesse-mockrin-sebastian-ii-2018.jpg',
    gradient: 'sage',
    visibility: 'private',
    provenance: [
      { date: '2024', event: 'Acquired from Galerie Droste', location: 'Wuppertal' },
      { date: '2020', event: 'Created by artist' },
    ],
    description: 'A contemporary reinterpretation of classical martyrdom imagery, rendered with Mockrin\'s characteristic sensitivity.',
  },
  {
    id: 'asad-faulwell-tangled-web',
    title: 'A Tangled Web',
    artistId: 'asad-faulwell',
    artistName: 'Asad Faulwell',
    year: 2019,
    medium: 'Acrylic and mixed media on canvas',
    dimensions: '183 × 183 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/2415f071fa2f2660d3380a9766c53f5fj/galeriedroste-asad-faulwell-a-tangled-web-2019.jpg',
    gradient: 'pink-purple',
    visibility: 'private',
    provenance: [
      { date: '2023', event: 'Private collection', location: 'New York' },
      { date: '2019', event: 'Created by artist' },
    ],
    description: 'A complex, layered composition exploring cultural narratives through intricate patterns and symbolic imagery.',
  },
  {
    id: 'tamara-malcher-huhnerdiebin',
    title: 'Hühnerdiebin',
    artistId: 'tamara-malcher',
    artistName: 'Tamara Malcher',
    year: 2019,
    medium: 'Acrylic and pastel on canvas',
    dimensions: '100 × 100 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/1ddc5b0e0a7dbdc0cc6a74c049fccaf3j/galeriedroste-tamara-malcher-h-hnerdiebin-2019.jpg',
    gradient: 'lime-dark',
    visibility: 'shared',
    provenance: [
      { date: '2024', event: 'Acquired from Galerie Droste', location: 'Wuppertal' },
      { date: '2019', event: 'Created by artist' },
    ],
    description: 'A playful yet thought-provoking figurative work that captures a moment of mischief and freedom.',
  },
  {
    id: 'brian-lotti-boat-park-shade',
    title: 'Boat, Park, Shade',
    artistId: 'brian-lotti',
    artistName: 'Brian Lotti',
    year: 2020,
    medium: 'Oil paint on Stonehenge paper',
    dimensions: '56 × 76 cm',
    imageUrl: 'https://static-assets.artlogic.net/w_1200,c_limit,f_auto,fl_lossy,q_auto/artlogicstorage/galeriedroste/images/view/4aec7934ed1e8ca44cad843314675d9cj/galeriedroste-brian-lotti-boat-park-shade-2020.jpg',
    gradient: 'sage',
    visibility: 'private',
    provenance: [
      { date: '2024', event: 'Private collection' },
      { date: '2020', event: 'Created by artist' },
    ],
    description: 'A contemplative scene capturing the quiet beauty of everyday moments, rendered with sensitivity and restraint.',
    artistNotes: [
      {
        text: 'Boat, Park, Shade was painted on a quiet afternoon. I wanted to capture that specific quality of light when the day is winding down.',
        date: '2024-02-10',
        type: 'about-work',
      },
    ],
  },
];

// Mock collectors who also own works by the same artists
export const collectors: Collector[] = [
  {
    id: 'c1',
    name: 'Sarah Chen',
    initials: 'SC',
    location: 'New York',
    collectingSince: 2018,
    worksCount: 47,
    artistsCount: 12,
    contact: {
      instagram: 'sarahchen.art',
      linkedin: 'sarahchen',
      email: 'sarah@example.com',
    },
  },
  {
    id: 'c2',
    name: 'Marcus Weber',
    initials: 'MW',
    location: 'Berlin',
    collectingSince: 2015,
    worksCount: 89,
    artistsCount: 23,
    contact: {
      instagram: 'mweber_collects',
      phone: '+49123456789',
    },
  },
  {
    id: 'c3',
    name: 'Elena Rossi',
    initials: 'ER',
    location: 'Milan',
    collectingSince: 2020,
    worksCount: 18,
    artistsCount: 6,
    contact: {
      linkedin: 'elenarossi',
      email: 'elena.rossi@example.com',
    },
  },
  {
    id: 'c4',
    name: 'James Park',
    initials: 'JP',
    location: 'Seoul',
    collectingSince: 2019,
    worksCount: 34,
    artistsCount: 9,
  },
];

export function getArtwork(id: string): Artwork | undefined {
  return artworks.find(a => a.id === id);
}

export function getArtist(id: string): Artist | undefined {
  return artists.find(a => a.id === id);
}

export function getArtworksByArtist(artistId: string): Artwork[] {
  return artworks.filter(a => a.artistId === artistId);
}

export function getCollectorsForArtist(artistId: string): Collector[] {
  // In production, this would filter collectors who own works by this artist
  // For now, return a random subset of collectors
  return collectors.slice(0, Math.floor(Math.random() * 3) + 1);
}
