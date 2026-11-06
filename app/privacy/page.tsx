import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="6 November 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: email address, display name and a securely hashed password (handled by our authentication provider, Supabase).</li>
          <li>Fashion profile: the styles, colours, budget, occasions, sizes and fit preferences you choose to share. Optional questions can be skipped.</li>
          <li>Images you upload: optional profile/outfit photos and photos of wardrobe items.</li>
          <li>Usage data: outfit requests, generated recommendations, ratings, saved looks and stylist chat messages.</li>
        </ul>
      </section>
      <section>
        <h2>How photos are processed</h2>
        <ul>
          <li>Uploading a photo is always optional.</li>
          <li>Before a photo is sent to our AI provider to inform styling suggestions, we ask for your explicit consent for that request.</li>
          <li>Photos are used only for clothing and styling context. We do not use them to infer sensitive attributes such as religion, caste, ethnicity, health, sexual orientation or political views, and our AI instructions forbid it.</li>
          <li>Photos are stored in private storage. They are only accessible to your account, through short-lived signed links.</li>
          <li>Outfit images we generate are inspiration visuals, not realistic previews of you.</li>
        </ul>
      </section>
      <section>
        <h2>Third-party processors</h2>
        <ul>
          <li>Supabase — authentication, database and file storage.</li>
          <li>Our AI provider (for example Google Gemini) — processes your request text and, with consent, your photo to produce recommendations. We send only what is needed for the request.</li>
          <li>Razorpay — payment processing for paid plans. We never see or store your full card details.</li>
          <li>Vercel — application hosting.</li>
        </ul>
      </section>
      <section>
        <h2>Retention</h2>
        <ul>
          <li>Uploaded photos are kept until you delete them or delete your account.</li>
          <li>Recommendations, saved looks and chat history are kept until you delete them or your account.</li>
          <li>Aggregated, non-identifying usage statistics may be retained to operate and improve the service.</li>
        </ul>
      </section>
      <section>
        <h2>Your choices and rights</h2>
        <ul>
          <li>Edit your fashion profile at any time.</li>
          <li>Delete individual photos, wardrobe items, saved looks and conversations.</li>
          <li>Delete your account from Settings — this permanently removes your profile, images and history.</li>
          <li>Contact us to access or correct your data.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
