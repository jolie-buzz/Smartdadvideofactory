import { Link } from "wouter";

type LegalPageProps = {
  type: "terms" | "privacy";
};

const lastUpdated = "June 15, 2026";
const supportEmail = "brandbuzzerph@gmail.com";

function LegalShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img src="/buzzly-logo.png" alt="Buzzly" className="h-9 w-9 object-contain" />
            <span>Buzzly</span>
          </Link>
          <div className="flex gap-3 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>

        <section className="space-y-4 border-b pb-8">
          <p className="text-sm font-medium text-primary">Last updated {lastUpdated}</p>
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
          <p className="text-base leading-7 text-muted-foreground">{intro}</p>
        </section>

        <article className="legal-copy mt-8 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
          {children}
        </article>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      intro="These Terms govern your access to and use of Buzzly, an AI-assisted video production web application."
    >
      <Section title="1. Acceptance">
        <p>
          By creating an account or using Buzzly, you agree to these Terms of Service. If you do not agree, do not use the service.
        </p>
      </Section>

      <Section title="2. Service">
        <p>
          Buzzly helps users upload media, create video setups, generate scripts, voiceovers, captions, edits, and rendered video outputs. Features may change as the product improves.
        </p>
      </Section>

      <Section title="3. Accounts">
        <p>
          You are responsible for keeping your login credentials secure and for activity that happens under your account. We may approve, restrict, suspend, or remove accounts to protect the service and other users.
        </p>
      </Section>

      <Section title="4. User Content">
        <p>
          You retain ownership of photos, videos, audio, scripts, prompts, and other content you upload or create. You grant Buzzly permission to process, store, transform, and render that content only as needed to provide the service.
        </p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>
          You may not use Buzzly to create, upload, or distribute illegal content, content that violates another person's rights, malware, deceptive impersonation, or content that abuses the service infrastructure.
        </p>
      </Section>

      <Section title="6. AI Outputs">
        <p>
          AI-generated scripts, captions, voiceovers, and other outputs may be inaccurate or require review. You are responsible for checking final content before publishing or using it commercially.
        </p>
      </Section>

      <Section title="7. Third-Party Services">
        <p>
          Buzzly may use third-party services for authentication, hosting, storage, AI generation, speech generation, transcription, rendering, and analytics. Their terms may also apply to your use of related features.
        </p>
      </Section>

      <Section title="8. Availability">
        <p>
          We aim to keep Buzzly available, but we do not guarantee uninterrupted service. We may update, pause, or discontinue features at any time.
        </p>
      </Section>

      <Section title="9. Disclaimers and Liability">
        <p>
          Buzzly is provided as-is and as-available. To the maximum extent allowed by law, Buzzly is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or business opportunities.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Questions about these Terms may be sent to <a className="text-primary hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </Section>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="This Privacy Policy explains how Buzzly collects, uses, stores, and protects information when you use the app."
    >
      <Section title="1. Information We Collect">
        <p>
          We may collect account information, uploaded media, prompts, scripts, generated outputs, setup settings, job logs, and technical information such as device, browser, usage, and error data.
        </p>
      </Section>

      <Section title="2. How We Use Information">
        <p>
          We use information to operate Buzzly, authenticate accounts, process uploads, generate scripts and voiceovers, render videos, provide support, improve reliability, prevent abuse, and maintain security.
        </p>
      </Section>

      <Section title="3. Media and Generated Content">
        <p>
          Photos, videos, audio, prompts, and generated files are processed to provide the features you request. This may include sending content to third-party AI, storage, transcription, speech, and rendering providers.
        </p>
      </Section>

      <Section title="4. Sharing">
        <p>
          We do not sell personal information. We may share information with service providers that help run Buzzly, when required by law, to protect rights and safety, or with your direction when you use sharing features.
        </p>
      </Section>

      <Section title="5. Storage and Retention">
        <p>
          We keep account data, uploaded media, generated assets, and logs for as long as needed to provide the service, meet legal obligations, resolve disputes, improve the product, or enforce our terms.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          We use reasonable administrative, technical, and organizational safeguards to protect information. No online service can guarantee absolute security.
        </p>
      </Section>

      <Section title="7. Your Choices">
        <p>
          You may request access, correction, export, or deletion of your account information where applicable. Some information may be retained when needed for security, legal, or operational reasons.
        </p>
      </Section>

      <Section title="8. Children">
        <p>
          Buzzly is not intended for children under 13. We do not knowingly collect personal information from children under 13.
        </p>
      </Section>

      <Section title="9. Changes">
        <p>
          We may update this Privacy Policy from time to time. The latest version will be posted on this page with the updated date.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Privacy questions or requests may be sent to <a className="text-primary hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </Section>
    </LegalShell>
  );
}

export default function LegalPage({ type }: LegalPageProps) {
  return type === "terms" ? <TermsPage /> : <PrivacyPage />;
}
