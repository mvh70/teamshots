import React from 'react';
import { Metadata } from 'next';
import { Link } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Terms of Service | TeamShotsPro',
  description: 'Terms of Service for TeamShotsPro - AI-powered professional headshot generation.',
};

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-4xl font-display font-bold mb-4">Terms of Service</h1>
        <p className="text-gray-500">Last Updated: November 15, 2025</p>
      </header>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">1. Acceptance of Terms</h2>
        <p>
          By accessing teamshotspro.com or photoshotspro.com, you agree to these Terms. If you represent a company (using teamshotspro.com), you certify that you have the authority to bind that entity to these terms.
        </p>
        <p>
          <strong>Age Requirement:</strong> You must be at least 18 years old to create an account and use the Services. By creating an account, you represent and warrant that you are at least 18 years of age.
        </p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">2. The Service</h2>
        <p>
          The Service utilizes Generative AI to create synthetic professional photography. All generated images are AI-created and are not real photographs.
        </p>
        <p>
          <strong>Domain Separation:</strong> teamshotspro.com is for teams and businesses. photoshotspro.com is for individual users.
        </p>
        <p>
          <strong>Pricing:</strong> All pricing is displayed on our pricing pages at{' '}
          <a href="https://teamshotspro.com/pricing" className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">teamshotspro.com/pricing</a>{' '}
          and{' '}
          <a href="https://photoshotspro.com/pricing" className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">photoshotspro.com/pricing</a>.
          Prices are subject to change. All purchases are one-time payments, not subscriptions. Top-ups are available for additional photos.
        </p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">3. User & Team Obligations</h2>
        <p><strong>Account Security:</strong> You are responsible for all activity under your account.</p>
        <p><strong>Team Admins:</strong> Admins manage team invitations and photo settings. Each team member provides their own consent when uploading their selfie.</p>
        
        <div className="mt-4">
          <p><strong>Acceptable Use:</strong> You agree NOT to upload photos of:</p>
          <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
            <li>Minors (under 18).</li>
            <li>Celebrities or public figures without rights.</li>
            <li>Nudity, violence, or illegal content.</li>
            <li>Third parties who have not given you explicit consent.</li>
          </ul>
        </div>

        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
          <p>
            <strong>Content Moderation:</strong> We employ automated AI safety filters to detect and reject inappropriate content. &ldquo;Inappropriate content&rdquo; includes, but is not limited to: nudity, sexually explicit material, violent or graphic imagery, hate symbols, content promoting illegal activities, and any content that violates the acceptable use policy above. Attempts to bypass these filters or repeatedly upload prohibited content will result in an immediate and permanent ban without refund.
          </p>
        </div>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">4. Refund Policy</h2>
        <p className="italic text-gray-600">Please read carefully before purchasing.</p>
        
        <p><strong>Free Tier First:</strong> We provide a &ldquo;Try It For Free&rdquo; tier so you can evaluate the AI&apos;s output quality and likeness accuracy before purchasing. The free tier includes limited customization options and includes TeamShotsPro branding on generated images.</p>
        
        <p><strong>Free Retries Included:</strong> Each photo includes free retries to perfect your results. The number of retries depends on your package—see our <Link href="/pricing" className="text-brand-primary hover:underline">pricing page</Link> for details.</p>
        
        <p><strong>No Refunds for Aesthetics:</strong> AI generation is subjective. We do not issue refunds if you do not like the aesthetic style, lighting, or artistic interpretation of the result. By purchasing, you accept that AI results may vary.</p>
        
        <div className="mt-4">
          <p><strong>Replacement Credits for Technical Errors:</strong> We do not offer cash refunds. However, we will issue replacement photo credits if a technical failure prevents the delivery of your photos. Examples include:</p>
          <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
            <li>System crashes resulting in no image delivery.</li>
            <li>Server timeouts where photos were deducted but no images produced.</li>
            <li>Corrupted file downloads.</li>
          </ul>
        </div>
        
        <p className="mt-4">To claim replacement credits, email <a href="mailto:support@teamshotspro.com" className="text-brand-primary hover:underline">support@teamshotspro.com</a> (for teams) or <a href="mailto:support@photoshotspro.com" className="text-brand-primary hover:underline">support@photoshotspro.com</a> (for individuals) with your transaction details.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">5. Intellectual Property</h2>
        <p><strong>Your Inputs:</strong> You retain full ownership of the photos you upload. You grant us a limited, non-exclusive license to process these photos solely to generate your results. This license terminates when you delete your account.</p>
        <p><strong>Your Outputs:</strong> You are granted full commercial rights to use the generated images for any purpose, including LinkedIn, websites, marketing materials, print, and merchandise. You may freely edit, modify, crop, or alter the generated images as you see fit. You may not resell the images themselves as stock photography or as a competing service. For free tier generations, commercial rights apply but images include TeamShotsPro branding.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">6. Limitation of Liability</h2>
        <p>The Service is provided &ldquo;AS IS.&rdquo; To the fullest extent permitted by law, TeamShotsPro shall not be liable for any indirect damages, lost profits, or data loss arising from your use of the Service. Our total liability is limited to the amount you paid us in the 12 months preceding the claim.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">7. Governing Law & Dispute Resolution</h2>
        <p>These Terms are governed by the laws of Switzerland.</p>
        <p><strong>Amicable Resolution:</strong> You agree to attempt to resolve any dispute informally by contacting <a href="mailto:support@teamshotspro.com" className="text-brand-primary hover:underline">support@teamshotspro.com</a> (for teams) or <a href="mailto:support@photoshotspro.com" className="text-brand-primary hover:underline">support@photoshotspro.com</a> (for individuals). We will work in good faith to resolve any issues within 30 days.</p>
        <p><strong>Arbitration:</strong> If informal resolution fails, either party may elect to resolve the dispute through binding arbitration administered under the Swiss Rules of International Arbitration. The arbitration shall be conducted in English, with the seat of arbitration in Zurich, Switzerland. The arbitrator&apos;s decision shall be final and binding.</p>
        <p><strong>Jurisdiction:</strong> If arbitration is not elected, any legal disputes shall be subject to the exclusive jurisdiction of the courts of Zurich, Switzerland.</p>
      </section>

      <hr className="border-gray-200 my-8" />

      <div className="text-center text-gray-500">
        <p>See also: <Link href="/legal/privacy" className="text-brand-primary hover:underline">Privacy Policy</Link></p>
      </div>
    </article>
  );
}
