// =====================================================
// STUDIO CONFIGURATION - Single Source of Truth
// Update these values to change them globally across the app
// =====================================================

export const studioConfig = {
  // Studio Identity
  name: "Ajanta Photography",
  tagline: "Capturing timeless moments with artistry and elegance",
  description: "Premium wedding and event photography in The Nilgiris",
  
  // Contact Information
  contact: {
    phones: ["+91 94435 68486", "+91 76398 88486"],
    primaryPhone: "+91 94435 68486",
    whatsapp: "+91 94435 68486",
    whatsappLink: "https://wa.me/919443568486",
    email: "ajantastudiopandalur@gmail.com",
    landline: "04262 296411",
  },
  
  // Social Media
  social: {
    instagram: "@ajanta_photography",
    instagramUrl: "https://instagram.com/ajanta_photography",
    facebook: "Ajanta Photography",
    facebookUrl: "#",
  },
  
  // Address
  address: {
    line1: "GHSS School Junction",
    line2: "Pandalur, The Nilgiris",
    pincode: "643233",
    full: "GHSS School Junction, Pandalur, The Nilgiris – 643233",
    googleMapsUrl: "https://maps.google.com/?q=GHSS+School+Junction+Pandalur+Nilgiris",
    // Pandalur coordinates for map embed
    coordinates: {
      lat: 11.4833,
      lng: 76.6500,
    },
  },
  
  // Business Hours
  hours: {
    weekdays: "9:00 AM - 7:00 PM",
    saturday: "9:00 AM - 7:00 PM",
    sunday: "By appointment only",
  },
  
  // SEO & Meta
  seo: {
    title: "Ajanta Photography | Premium Wedding & Event Photography",
    description: "Capture your special moments with Ajanta Photography. Professional wedding, pre-wedding, and event photography in Pandalur, The Nilgiris.",
    keywords: "wedding photography, Pandalur photographer, Nilgiris photography, event photography, pre-wedding shoot",
    ogImage: "/og-image.jpg",
  },
  
  // Domain
  domain: "ajantaphotography.in",
  baseUrl: "https://ajantaphotography.in",
} as const;

// Email signature for templates
export const emailSignature = `
Ajanta Photography
${studioConfig.address.line1}, ${studioConfig.address.line2}
${studioConfig.address.pincode}
Phone: ${studioConfig.contact.phones.join(" / ")}
Email: ${studioConfig.contact.email}
Instagram: ${studioConfig.social.instagram}
`.trim();

// Helper to format phone for tel: links
export const formatPhoneLink = (phone: string) => {
  return `tel:${phone.replace(/\s/g, "")}`;
};

// Helper to format WhatsApp link with message
export const formatWhatsAppLink = (message?: string) => {
  const baseUrl = `https://wa.me/${studioConfig.contact.whatsapp.replace(/[^0-9]/g, "")}`;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  return baseUrl;
};

export default studioConfig;
