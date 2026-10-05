export interface StoreProfile {
  name: string;
  address: string;
  contact: string;
  bankName: string;
  accountNumber: string;
  bankAccountNumber?: string;
  accountHolder: string;
  bankAccountName?: string;
  signerName: string;
  signerContact?: string;
  logoBase64?: string;
  signatureBase64?: string;
  stampBase64?: string;
  stampSignatureCombinedBase64?: string;
  footerNote?: string;
}

const HTG_PROFILE: StoreProfile = {
  "name": "CV. HANDAI TOLAN GROUP",
  "address": "Jl. Krasak, RT.5/RW.1, Glowong, Wringin Agung\\nKec. Gambiran, Kab. Banyuwangi",
  "contact": "Tlp. 0822 2939 4425 | E. cvhandaitolangroup@gmail.com",
  "bankName": "BNI",
  "accountNumber": "2026372715",
  "bankAccountNumber": "2026372715",
  "accountHolder": "Vica Indah Narsisus",
  "bankAccountName": "Vica Indah Narsisus",
  "signerName": "Vica Indah Narsisus",
  "logoBase64": "/store-profile-assets/htg_logo.png",
  "signatureBase64": "/store-profile-assets/htg_signature.png",
  "stampBase64": "/store-profile-assets/htg_stamp.png"
};

const LUWENG_BOGA_PROFILE: StoreProfile = {
  "name": "UD LUWENG BOGA",
  "address": "Dusun Glowong, Rt 5 Rw 1 Desa Wringinagung\\nKec Gambiran Kab Banyuwangi",
  "contact": "Tlp. +6281235227185",
  "bankName": "BNI",
  "accountNumber": "2095791745",
  "bankAccountNumber": "2095791745",
  "accountHolder": "Khoiriyah Yusuf",
  "bankAccountName": "Khoiriyah Yusuf",
  "signerName": "Khoiriyah Yusuf",
  "logoBase64": "/store-profile-assets/luweng_boga_logo.png",
  "signatureBase64": "/store-profile-assets/luweng_boga_signature.png",
  "stampBase64": "/store-profile-assets/luweng_boga_stamp.png"
};

const LUMBUNG_ADIFRUTA_PROFILE: StoreProfile = {
  "name": "UD LUMBUNG ADIFRUTA",
  "address": "Dusun Glowong, Rt 5 Rw 1 Desa Wringinagung\\nKec. Gambiran, Kab. Banyuwangi",
  "contact": "Tlp. 082229394425",
  "bankName": "BNI",
  "accountNumber": "2095806527",
  "bankAccountNumber": "2095806527",
  "accountHolder": "Adi Suprapto",
  "bankAccountName": "Adi Suprapto",
  "signerName": "Adi Suprapto",
  "logoBase64": "/store-profile-assets/lumbung_adifruta_logo.png",
  "signatureBase64": "/store-profile-assets/lumbung_adifruta_signature.png",
  "stampBase64": "/store-profile-assets/lumbung_adifruta_stamp.png"
};

const PROHE_PROFILE: StoreProfile = {
  "name": "UD PROHE WANGI",
  "address": "Dusun Glowong, RT 5 RW 1 Desa Wringinagung\nKec. Gambiran, Kab. Banyuwangi",
  "contact": "Tlp. 085792083866",
  "bankName": "BNI",
  "accountNumber": "2098103145",
  "bankAccountNumber": "2098103145",
  "accountHolder": "Prima Dana Nirwana",
  "bankAccountName": "Prima Dana Nirwana",
  "signerName": "Prima Dana Nirwana",
  "logoBase64": "/store-profile-assets/prohe_logo.png",
  "signatureBase64": "",
  "stampBase64": "",
  "stampSignatureCombinedBase64": "/store-profile-assets/prohe_stamp_signature_combined.png",
  "footerNote": "Barang yang sudah dibeli tidak dapat ditukar/dikembalikan"
};

export const STORE_PROFILES: Record<string, StoreProfile> = {
  "HTG": HTG_PROFILE,
  "LUWENG BOGA": LUWENG_BOGA_PROFILE,
  "LUMBUNG ADIFRUTA": LUMBUNG_ADIFRUTA_PROFILE,
  "PROHE": PROHE_PROFILE,

  // Aliases referencing canonical profiles directly
  "ADIFRUITA": LUMBUNG_ADIFRUTA_PROFILE,
  "ADIFRUTA": LUMBUNG_ADIFRUTA_PROFILE,
  "LUMBUNG ADIFRUITA": LUMBUNG_ADIFRUTA_PROFILE,
  "UD LUMBUNG ADIFRUTA": LUMBUNG_ADIFRUTA_PROFILE,
  "UD LUMBUNG ADIFRUITA": LUMBUNG_ADIFRUTA_PROFILE,
  "LA": LUMBUNG_ADIFRUTA_PROFILE,
  "LB": LUWENG_BOGA_PROFILE,
  "UD LUWENG BOGA": LUWENG_BOGA_PROFILE,
  "UD PROHE WANGI": PROHE_PROFILE,
  "PW": PROHE_PROFILE,
  "PW PROHE": PROHE_PROFILE,
  "CV. HANDAI TOLAN GROUP": HTG_PROFILE,
  "HANDAI TOLAN GROUP": HTG_PROFILE,
};

export function getStoreProfile(storeName?: string): StoreProfile {
  const norm = (storeName || "").trim().toUpperCase();
  if (norm.includes("LUWENG") || norm.includes("LEMBUNG") || norm.includes("BOGA") || norm === "LB" || norm.startsWith("LB ") || norm.endsWith(" LB")) {
    return LUWENG_BOGA_PROFILE;
  }
  if (norm.includes("PROHE") || norm === "PW" || norm.startsWith("PW ") || norm.endsWith(" PW") || norm.includes("WANGI")) {
    return PROHE_PROFILE;
  }
  if (
    norm.includes("ADIFRUTA") ||
    norm.includes("ADIFRUITA") ||
    norm.includes("ADIFR") ||
    norm.includes("FRUITA") ||
    norm.includes("FRUTA") ||
    norm === "LA" ||
    norm.startsWith("LA ") ||
    norm.endsWith(" LA") ||
    norm.includes("LUMBUNG")
  ) {
    return LUMBUNG_ADIFRUTA_PROFILE;
  }
  if (norm.includes("HANDAI") || norm.includes("TOLAN") || norm.includes("HTG")) {
    return HTG_PROFILE;
  }
  return STORE_PROFILES[norm] || HTG_PROFILE;
}
