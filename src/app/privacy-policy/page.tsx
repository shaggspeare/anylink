import Link from "next/link";
import type { ReactNode } from "react";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Privacy Policy — AnyLink",
  description: "What AnyLink collects, why, who processes it, and how to delete it.",
};

const UPDATED = "October 10, 2026";
const CONTACT = "privacy@anylink.space";

/** Plain, specific and true to the code: Google's OAuth review and the App Store both read it. */
export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <main className="relative mx-auto flex max-w-[760px] flex-col gap-8 px-5 pb-20 pt-[max(32px,env(safe-area-inset-top))]">
        <Link href="/" className="flex items-center gap-2 self-start">
          <Logo className="h-9 w-9" />
          <span className="text-wordmark">AnyLink</span>
        </Link>

        <header className="flex flex-col gap-3">
          <h1 className="text-hero text-[36px] leading-tight">Privacy Policy</h1>
          <p className="text-meta text-ink/55">Last updated: {UPDATED}</p>
          <P>
            AnyLink (&ldquo;AnyLink&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal library for saved links,
            notes and images, available at <A href="https://www.anylink.space">www.anylink.space</A> and as an iOS
            app. This policy explains what information we collect, how we use it, who helps us process it, how long we
            keep it, and the choices you have. It applies to the website, the web app and the iOS app (including its
            share extension).
          </P>
          <P>
            The short version: we collect what you need to sign in and what you choose to save. We use it only to run
            AnyLink for you. We don&apos;t sell it, we don&apos;t show ads, and we don&apos;t use analytics or tracking
            tools.
          </P>
        </header>

        <Section title="1. Information we collect">
          <H3>Account information</H3>
          <P>When you create an account or sign in, we receive:</P>
          <Ul>
            <li>
              <b>Email sign-in:</b> your email address. We send it a one-time code and sign-in link.
            </li>
            <li>
              <b>Sign in with Google:</b> your email address, your name and your profile picture URL, together with
              Google&apos;s unique identifier for your account. We request only the basic <code>openid</code>,{" "}
              <code>email</code> and <code>profile</code> scopes. We do not access your Gmail, Drive, Contacts,
              Calendar or any other Google data.
            </li>
            <li>
              <b>Sign in with Apple:</b> Apple&apos;s identifier for your account and your email address. If you choose
              &ldquo;Hide My Email&rdquo;, that is a private relay address. Apple may share your name the first time
              you sign in.
            </li>
          </Ul>
          <P>We also store when your account was created and when you last signed in.</P>

          <H3>Content you save</H3>
          <P>AnyLink stores what you put in your library:</P>
          <Ul>
            <li>the links (URLs) you save, and the collections, tags, notes, highlights, favorites and pins you add to them;</li>
            <li>text notes you write;</li>
            <li>images you upload or share to AnyLink, with their captions;</li>
            <li>bookmark files you import (for example, a browser or Telegram export), including the titles, folders and dates in them;</li>
            <li>price alert thresholds you set on product links.</li>
          </Ul>

          <H3>Information we fetch about the links you save</H3>
          <P>
            When you save a link, our servers visit that public web page to build its card. We store what we read
            there: the title, a summary, the article text, the main image (copied to our storage), the content type,
            and for products the price, availability and specifications. We periodically re-check saved links to see
            whether they still work, and re-check product pages to track price changes. These requests come from our
            servers, not from your device.
          </P>

          <H3>How you use AnyLink</H3>
          <P>
            We keep a record of some actions you take inside your library: for example, moving a link to a collection,
            or accepting or changing a suggested grouping, along with the answers you give during onboarding. We use
            it only to improve how AnyLink organises <i>your</i> library. It is not used for advertising and it is
            not shared.
          </P>

          <H3>Technical information</H3>
          <P>
            Like any website, our hosting provider receives your IP address, browser or device type, and the pages or
            API endpoints requested. It keeps these in short-lived server logs for security and debugging. For
            visitors who are not signed in, we use the IP address to limit how many link previews can be requested,
            which prevents abuse. That counter is held in memory only and is not stored.
          </P>

          <H3>What we do not collect</H3>
          <P>
            We do not use analytics, advertising or tracking tools. We do not collect your location, contacts,
            browsing history, or data from other apps. We do not use third-party cookies.
          </P>
        </Section>

        <Section title="2. Using AnyLink without an account">
          <P>
            You can try AnyLink without signing in. On the website, the demo library and up to two items of your own
            are stored only in your browser&apos;s local storage. On iOS, they are stored only on your device. If you
            then create an account, those items are uploaded to it; otherwise they never leave your device, except
            that a link you paste is sent to our servers so we can build its preview.
          </P>
        </Section>

        <Section title="3. How we use information">
          <Ul>
            <li>To create and secure your account and sign you in.</li>
            <li>To store your library and sync it between the website and the iOS app.</li>
            <li>To build link previews, summaries and reader views, to check links for breakage, and to track prices you asked us to watch.</li>
            <li>To suggest collections when you import or tidy a large set of links.</li>
            <li>To send sign-in emails. We do not send marketing emails.</li>
            <li>To prevent abuse, keep the service running and fix problems.</li>
          </Ul>
          <P>
            Where data-protection law requires a legal basis (for example, under the GDPR), we rely on{" "}
            <b>performance of our contract with you</b> to provide the service you signed up for, and on our{" "}
            <b>legitimate interest</b> in keeping AnyLink secure and working.
          </P>
        </Section>

        <Section title="4. Google user data">
          <P>
            If you sign in with Google, we use your email address, name and profile picture only to create your
            AnyLink account, to identify you when you sign in, and to show you which account you are signed in with.
            We do not use Google user data for advertising. We do not sell it, and we do not transfer it to anyone
            except the service providers listed below, who run AnyLink on our behalf. We do not use it to train
            artificial-intelligence or machine-learning models, and no human reads it except where you ask us to, for
            security reasons, or where the law requires it.
          </P>
          <P>
            AnyLink&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <A href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </A>
            , including the Limited Use requirements.
          </P>
        </Section>

        <Section title="5. Who processes your information">
          <P>We use a small number of service providers to run AnyLink. Each one processes data only to provide its service to us:</P>
          <Ul>
            <li>
              <b>Supabase</b> stores the database, the uploaded and copied images, and the sign-in system. Data is
              stored in the EU (Frankfurt, Germany).
            </li>
            <li>
              <b>Vercel</b> hosts the website and the servers that respond to the web and iOS apps.
            </li>
            <li>
              <b>OpenAI</b> receives the text of web pages you save, so it can write a summary and structure the card.
              When you ask AnyLink to group your links, OpenAI also receives the titles, domains and folder names of
              those links. Your notes, images and account details are not sent to OpenAI. Under OpenAI&apos;s API
              terms, data sent through the API is not used to train its models.
            </li>
            <li>
              <b>Resend</b> delivers sign-in emails, so it receives your email address.
            </li>
            <li>
              <b>Google</b> and <b>Apple</b> handle the sign-in, if you choose them.
            </li>
          </Ul>
          <P>
            Some of these providers process data in the United States and other countries. Where we transfer personal
            data out of the European Economic Area or the UK, we rely on our providers&apos; Standard Contractual Clauses
            or an equivalent safeguard.
          </P>
          <P>
            We do not sell or rent personal information, and we do not share it for advertising. We will disclose
            information only if the law requires it, or to protect the rights and safety of our users or of AnyLink.
          </P>
        </Section>

        <Section title="6. Images and link previews">
          <P>
            Images you upload, and preview images we copy from saved pages, are stored as files with a long, random
            address. Anyone who has that exact address can open the image, but the addresses are not listed or
            published anywhere. Don&apos;t save images you would not want viewable by someone you share the address
            with.
          </P>
        </Section>

        <Section title="7. Cookies and local storage">
          <P>
            The website uses one essential cookie, which keeps you signed in. It also uses your browser&apos;s local
            storage for your preferences (for example, theme and default collection) and for a guest&apos;s unsaved
            items. We do not use advertising or analytics cookies, so there is nothing to opt out of.
          </P>
        </Section>

        <Section title="8. On your iPhone">
          <Ul>
            <li>
              <b>Clipboard:</b> to offer &ldquo;Save the link you copied&rdquo;, the app asks iOS whether the clipboard
              holds a web link. The clipboard is read only when you choose to save from it, and nothing is sent until
              you save. You can turn the suggestions off in Settings.
            </li>
            <li>
              <b>Share extension:</b> it receives only what you share to AnyLink.
            </li>
            <li>
              <b>Spotlight and Shortcuts:</b> titles of your saved items are indexed on your device so iOS search and
              Shortcuts can find them. This index stays on the device.
            </li>
            <li>
              <b>Offline copy:</b> a copy of your library and your images is kept on the device, so the app works
              offline. Signing out clears the library from the app; deleting the app removes everything it stored.
            </li>
          </Ul>
        </Section>

        <Section title="9. How long we keep information">
          <P>
            We keep your account and library for as long as you have an account. Items you delete go to Trash, where
            they stay until you empty it or delete them permanently. When you delete your account, your account, your
            entire library and your stored images are permanently deleted straight away. Our hosting provider&apos;s
            server logs and our database backups expire within 30 days.
          </P>
        </Section>

        <Section title="10. Your choices and rights">
          <Ul>
            <li>
              <b>Access and correction:</b> everything in your library is visible and editable in the app.
            </li>
            <li>
              <b>Deletion:</b> delete individual items at any time. To delete your account and everything in it, go to{" "}
              <b>Settings → Delete account</b> on the website or in the iOS app, or email us.
            </li>
            <li>
              <b>Export:</b> email us and we will send you a copy of your data.
            </li>
            <li>
              <b>Google and Apple access:</b> you can disconnect AnyLink at any time, from{" "}
              <A href="https://myaccount.google.com/permissions">your Google Account permissions</A>, or from your Apple
              ID settings under &ldquo;Sign in with Apple&rdquo;.
            </li>
          </Ul>
          <P>
            Depending on where you live (for example, in the EU, the UK, or California), you may also have the right to
            restrict or object to processing, to data portability, and to complain to your local data-protection
            authority. Contact us to exercise any of these rights. We will respond within 30 days, and we will not
            treat you differently for using them.
          </P>
        </Section>

        <Section title="11. Security">
          <P>
            All traffic is encrypted with HTTPS. Data is encrypted at rest by our storage provider. Each request is
            checked against the signed-in account, so you can only ever read or change your own library. Sign-in
            sessions are stored in the iOS Keychain on iPhone, and in a secure cookie on the web. No system is
            perfectly secure; if a breach affects your data, we will notify you as the law requires.
          </P>
        </Section>

        <Section title="12. Children">
          <P>
            AnyLink is not directed at children under 13 (or under 16 where local law requires), and we do not
            knowingly collect their personal information. If you believe a child has given us personal information,
            contact us and we will delete it.
          </P>
        </Section>

        <Section title="13. Changes to this policy">
          <P>
            If we change this policy, we will update the date at the top of this page. If a change is significant, we
            will tell you in the app or by email before it takes effect.
          </P>
        </Section>

        <Section title="14. Contact">
          <P>
            Questions or requests about your privacy: <A href={`mailto:${CONTACT}`}>{CONTACT}</A>.
          </P>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-55 flex flex-col gap-3 rounded-[22px] p-6">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-body font-semibold text-ink">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-body leading-[1.6] text-ink/75">{children}</p>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 text-body leading-[1.6] text-ink/75">{children}</ul>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="font-semibold text-ink underline underline-offset-2">
      {children}
    </a>
  );
}
