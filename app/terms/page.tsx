import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="6 November 2026">
      <section>
        <h2>The service</h2>
        <p>
          StyleMood AI provides AI-generated outfit suggestions for inspiration. Recommendations are suggestions, not
          professional advice, and may occasionally be inaccurate. Budget estimates are approximate and are not offers
          from any retailer.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be at least 13 years old to use StyleMood AI, and have a parent or guardian&apos;s consent if you are under 18.</li>
          <li>Keep your password confidential. You are responsible for activity on your account.</li>
          <li>Only upload photos you have the right to use. Do not upload images of other people without their permission.</li>
        </ul>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>No unlawful, harassing, sexually explicit or hateful content.</li>
          <li>No attempts to bypass usage limits, scrape the service or attack its security.</li>
        </ul>
      </section>
      <section>
        <h2>Plans and payments</h2>
        <p>
          Free accounts include a daily generation allowance. Paid plans, once available, are billed monthly in INR via
          Razorpay and can be cancelled at any time; access continues until the end of the paid period.
        </p>
      </section>
    </LegalPage>
  );
}
