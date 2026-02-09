import React from 'react';
import { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { constructMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { getBrand } from '@/config/brand';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const brand = getBrand(headersList);
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || brand.domain;
  const baseUrl = `${protocol}://${host}`;

  return constructMetadata({
    baseUrl,
    path: '/legal/privacy',
    locale,
    title: 'Privacy Policy',
    description: 'Privacy Policy for TeamShotsPro - Learn how we protect your data under GDPR and Swiss FADP.',
  });
}

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-4xl font-display font-bold mb-4">Privacy Policy</h1>
        <p className="text-gray-500">Last Updated: November 15, 2025</p>
      </header>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">1. Introduction</h2>
        <p>
          Welcome to TeamShotsPro (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We operate teamshotspro.com and portreya.com (collectively, the &ldquo;Services&rdquo;).
        </p>
        <p>
          We are committed to protecting your data. This policy outlines how we handle your personal and biometric information. We operate under strict data protection principles aligned with the Swiss Federal Act on Data Protection (FADP) and the GDPR.
        </p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">2. Information We Collect</h2>
        
        <h3 className="text-xl font-semibold mt-6">A. Account & Team Data</h3>
        <p><strong>Identity:</strong> Name, email address, password (hashed), and language preference.</p>
        <p><strong>Team Data:</strong> For teamshotspro.com users, we store team names, roles, and member email addresses managed by Team Admins.</p>

        <h3 className="text-xl font-semibold mt-6">B. Biometric & Image Data</h3>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-4">
          <p className="font-medium">
            <strong>Important:</strong> By uploading photos to our Service, you provide explicit consent for us to process your biometric data (facial features) as required under GDPR Article 9 for special category data. This processing is necessary to provide the AI headshot generation service you have requested.
          </p>
        </div>
        <p><strong>Input Data:</strong> We collect the photos (&ldquo;Selfies&rdquo;) you upload for the purpose of generating professional headshots.</p>
        <p><strong>Process Data:</strong> Our AI analyzes facial features in your uploads to map them onto professional styles. We do not use your photos to train any AI models. Your images are processed solely to generate your specific outputs and are not used for model improvement or training.</p>
        <p><strong>Output Data:</strong> We store the resulting AI-generated images. All generated images are AI-created and are not real photographs.</p>
        <p><strong>Content Moderation:</strong> Uploaded photos are automatically scanned using AI to detect and reject inappropriate content. This includes, but is not limited to: nudity, sexually explicit material, violent imagery, hate symbols, and content depicting minors. This moderation happens before processing and no inappropriate images are stored.</p>

        <h3 className="text-xl font-semibold mt-6">C. Financial Data</h3>
        <p>We use Stripe for payment processing. We do not store your credit card details. We only retain a transaction ID and customer reference number to manage your purchases.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">3. Infrastructure & Data Transfer</h2>
        <p>To provide high-performance AI services, your data flows through specific top-tier providers across different jurisdictions. By using the Service, you consent to these transfers:</p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 mt-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left border-b font-semibold">Data Type</th>
                <th className="px-4 py-2 text-left border-b font-semibold">Provider</th>
                <th className="px-4 py-2 text-left border-b font-semibold">Location</th>
                <th className="px-4 py-2 text-left border-b font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2 border-b">Hosting & Storage</td>
                <td className="px-4 py-2 border-b">Hetzner Online GmbH</td>
                <td className="px-4 py-2 border-b">Germany (EU)</td>
                <td className="px-4 py-2 border-b">Secure storage of photos and database.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b">AI Processing</td>
                <td className="px-4 py-2 border-b">Google Cloud (Vertex AI)</td>
                <td className="px-4 py-2 border-b">USA</td>
                <td className="px-4 py-2 border-b">Image generation.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b">Payments</td>
                <td className="px-4 py-2 border-b">Stripe</td>
                <td className="px-4 py-2 border-b">USA/Global</td>
                <td className="px-4 py-2 border-b">Payment processing.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b">Emails</td>
                <td className="px-4 py-2 border-b">Resend</td>
                <td className="px-4 py-2 border-b">USA</td>
                <td className="px-4 py-2 border-b">Transactional emails.</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b">Analytics</td>
                <td className="px-4 py-2 border-b">PostHog</td>
                <td className="px-4 py-2 border-b">EU/USA</td>
                <td className="px-4 py-2 border-b">Usage analytics.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4">For transfers to the United States, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission, as implemented by our service providers:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li><a href="https://cloud.google.com/terms/eu-model-contract-clause" className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Cloud SCCs</a></li>
          <li><a href="https://stripe.com/legal/dpa" className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe Data Processing Agreement</a></li>
          <li><a href="https://resend.com/legal/dpa" className="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">Resend DPA</a></li>
        </ul>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">4. Cookies & Tracking</h2>
        <p>We use the following cookies and tracking technologies:</p>
        <p><strong>Essential Cookies:</strong> Session and authentication cookies required for the Service to function (Auth.js).</p>
        <p><strong>Analytics:</strong> We use PostHog to understand how users interact with our Service and improve the user experience.</p>
        <p><strong>Payment:</strong> Stripe sets cookies necessary for secure payment processing.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">5. Data Retention Policy</h2>
        <p>All uploaded selfies and generated photos are retained as long as your account exists. You may request account deletion at any time, at which point all your data will be permanently deleted within 30 days of your request.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">6. Your Rights</h2>
        <p>Under GDPR and FADP, you have the following rights regarding your personal data:</p>
        
        <ul className="space-y-3 mt-4">
          <li><strong>Access & Export:</strong> Request a copy of your photos and personal data we hold about you.</li>
          <li><strong>Rectification:</strong> Update or correct inaccurate account information.</li>
          <li><strong>Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Request deletion of your account and all associated data.</li>
          <li><strong>Restriction:</strong> Request that we limit how we process your data in certain circumstances.</li>
          <li><strong>Data Portability:</strong> Receive your data in a structured, commonly used, machine-readable format.</li>
          <li><strong>Objection:</strong> Object to processing of your personal data in certain circumstances.</li>
          <li><strong>Withdraw Consent:</strong> Withdraw your consent for biometric data processing at any time by deleting your account.</li>
        </ul>

        <div className="bg-gray-50 p-4 rounded-lg mt-4">
          <p><strong>How to Exercise Your Rights:</strong> Contact us using the details in Section 8. We will respond to your request within 30 days. We may ask you to verify your identity before processing your request.</p>
        </div>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">7. Security</h2>
        <p>We employ enterprise-grade security measures including:</p>
        <ul className="list-disc list-inside ml-4 space-y-2 mt-2">
          <li><strong>Encryption in Transit:</strong> All data transmitted to and from our servers is protected using SSL/TLS encryption.</li>
          <li><strong>Encryption at Rest:</strong> Stored data is encrypted using industry-standard AES-256 encryption.</li>
          <li><strong>Access Controls:</strong> Strict role-based access controls limit who can access your data.</li>
          <li><strong>Secure Infrastructure:</strong> Our hosting provider (Hetzner) maintains ISO 27001 certification.</li>
        </ul>
        <p className="mt-4">While we strive for maximum security, no internet transmission is completely invulnerable. In the event of a data breach affecting your personal data, we will notify you and the relevant authorities as required by law.</p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold font-display">8. Contact</h2>
        <p>For privacy concerns, please contact us at:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li><strong>Teams:</strong> <a href="mailto:support@teamshotspro.com" className="text-brand-primary hover:underline">support@teamshotspro.com</a></li>
          <li><strong>Individuals:</strong> <a href="mailto:support@portreya.com" className="text-brand-primary hover:underline">support@portreya.com</a></li>
        </ul>
      </section>

      <hr className="border-gray-200 my-8" />

      <div className="text-center text-gray-500">
        <p>See also: <Link href="/legal/terms" className="text-brand-primary hover:underline">Terms of Service</Link></p>
      </div>
    </article>
  );
}
