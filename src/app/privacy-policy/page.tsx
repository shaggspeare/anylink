import Link from "next/link";
import type { ReactNode } from "react";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Privacy Policy — AnyLink",
  description: "What AnyLink collects, why, who processes it, and how to delete it.",
};

const UPDATED = "November 1, 2026";
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
            keep it, and the choices you have. It applies to the website, the web app, the iOS app (including its
            share extension) and the Chrome extension.
          </P>
          <P>
            The short version: we collect what you need to sign in and what you choose to save. We use it only to run
            AnyLink for you. We don&apos;t sell it, we don&apos;t show ads, and we don&apos;t use analytics or tracking
            tools. On iPhone you don&apos;t need an account at all: without Pro, your library stays on your devices and
            in your own iCloud, not on our servers.
          </P>
        </header>

        <Section title="1. Information we collect">
          <H3>Account information</H3>
          <P>When you create an account or sign in, we receive:</P>
          <Ul>
            <li>
              <b>Email and password:</b> your email address and your password. Our sign-in provider stores the password only as a secure hash, and we never see it. We email you only to confirm your account and to reset a forgotten password.
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
          <P>
            With an account on the website, and on iPhone with Pro, your library is stored on our servers. It holds
            what you put in it:
          </P>
          <Ul>
            <li>the links (URLs) you save, and the collections, tags, notes, highlights, favorites and pins you add to them;</li>
            <li>text notes you write;</li>
            <li>images you upload or share to AnyLink, with their captions;</li>
            <li>
              bookmark files and chats you import (for example, a browser bookmarks file, or a Telegram or WhatsApp
              export): the links in them, with their titles, folders and dates, and for a chat, the words written
              around each link;
            </li>
            <li>price alert thresholds you set on product links.</li>
          </Ul>
          <P>On iPhone without Pro, your library stays on your devices and in your iCloud instead (section 2).</P>

          <H3>Information we fetch about the links you save</H3>
          <P>
            When you save a link, our servers visit that public web page to build its card. For a library on our
            servers, we store what we read there: the title, the page&apos;s description, the article text, the main
            image (copied to our storage), the content type, and for products the price, availability and
            specifications. With Pro, we also store an AI summary and suggested tags (section 3). When you import links,
            we check each one once to see whether it still works. With Pro, we also re-check saved links periodically,
            and re-check product pages to track price changes. These requests come from our servers, not from your
            device.
          </P>

          <H3>Purchases</H3>
          <P>
            AnyLink Pro is bought in the iPhone app, and Apple handles the payment: we never see your card or any other
            payment details. When you buy, the app attaches your AnyLink account ID to the purchase (Apple calls it an
            &ldquo;app account token&rdquo;). The app then sends us Apple&apos;s signed record of the purchase, and
            Apple tells us directly when it renews, ends or is refunded. Using that ID, we store on your account your
            plan, the Pro product you bought (monthly, yearly or lifetime), and when Pro ends or last ended. We don&apos;t
            keep Apple&apos;s records themselves.
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
            browsing history, or data from other apps, apart from files you choose to import. We do not use
            third-party cookies.
          </P>
        </Section>

        <Section title="2. Using AnyLink without an account">
          <H3>On the website</H3>
          <P>
            You can try AnyLink without signing in. The demo library and up to two items of your own are stored only in
            your browser&apos;s local storage. If you then create an account, those items are uploaded to it; otherwise
            they never leave your browser, except that a link you paste is sent to our servers so we can build its
            preview.
          </P>

          <H3>On iPhone: your local library</H3>
          <P>
            On iPhone you don&apos;t need an account. Without Pro, your library (links, collections, notes and images)
            is kept on your device and, if iCloud is on, in your own iCloud account, so it syncs between your Apple
            devices. That copy lives in the app&apos;s private iCloud database (CloudKit), which only your Apple Account
            can read: Apple stores it under its own privacy policy, and we can&apos;t see it. Our servers never store a
            local library.
          </P>
          <P>A few features still use our servers. Each sends only what it needs, and we keep none of it:</P>
          <Ul>
            <li>
              <b>Link previews:</b> the link you save, so our servers can read the page and send back its title, image
              and reading time.
            </li>
            <li>
              <b>Import checks:</b> the addresses and titles of links you import, so our servers can tell you which ones
              no longer work.
            </li>
            <li>
              <b>Grouping:</b> the titles, domains and folder names of links you import (for a chat, the words written
              around each link), and your answers about what matters to you. These go to Anthropic to suggest collections
              (section 6).
            </li>
          </Ul>

          <H3>Device checks (App Attest)</H3>
          <P>
            So that only the real AnyLink app can use these features without an account, the app uses Apple&apos;s App
            Attest. The first time it needs our servers, it creates a key in your device&apos;s secure hardware, and
            Apple confirms that the key belongs to a genuine copy of AnyLink. For each key we store its ID and public
            key, a counter that shows each request is new, whether it came from a test build, when it was registered
            and last used, and how many previews, link checks and groupings it made that day. We use this only to
            prevent abuse and to apply daily limits. It isn&apos;t tied to any account, and it holds nothing about you
            or your library.
          </P>
        </Section>

        <Section title="3. AnyLink Pro">
          <P>Pro joins your iPhone and the web into one library on our servers, and adds features that run there:</P>
          <Ul>
            <li>
              <b>One library:</b> when you go Pro on iPhone, the app uploads your local library to your AnyLink account
              and merges it with anything already there. From then on, it&apos;s stored like any library on our servers
              (section 1). The copy on your device and in iCloud isn&apos;t deleted.
            </li>
            <li>
              <b>AI summaries and tags:</b> when you save a link, the text of the page goes to Anthropic, which writes a
              summary and suggests tags (section 6).
            </li>
            <li>
              <b>A second read:</b> a page that won&apos;t load for us is opened again in a headless browser on our
              servers.
            </li>
            <li>
              <b>Link health and prices:</b> we re-check your saved links to see whether they still work, and product
              pages for price changes.
            </li>
            <li>
              <b>Videos:</b> YouTube and Vimeo videos play in place, in YouTube&apos;s privacy-enhanced mode or with
              Vimeo&apos;s do-not-track setting. The player loads from YouTube or Vimeo, under their own privacy
              policies. On iPhone, it loads only when you tap play, and keeps no cookies.
            </li>
            <li>
              <b>Share links:</b> anyone with a collection&apos;s share link can see its name, its links with their
              titles, images and notes, and your display name if you set one. Turning sharing off breaks the link for
              good. While you&apos;re not on Pro, it reads as not found.
            </li>
            <li>
              <b>Export:</b> you can download your whole library as a file.
            </li>
          </Ul>
          <P>
            If Pro ends, nothing on our servers is deleted. Your iPhone goes back to a local library, copied from your
            account, and the website keeps working as before.
          </P>
        </Section>

        <Section title="4. How we use information">
          <Ul>
            <li>To create and secure your account and sign you in.</li>
            <li>To store your library and, with Pro, keep it in sync between the website and the iOS app.</li>
            <li>To build link previews, summaries and reader views, to check links for breakage, and to track prices you asked us to watch.</li>
            <li>To suggest collections when you import or tidy a large set of links.</li>
            <li>To record your Pro purchase and keep your plan up to date.</li>
            <li>To send sign-in emails. We do not send marketing emails.</li>
            <li>To prevent abuse (for example, with the device checks in section 2), keep the service running and fix problems.</li>
          </Ul>
          <P>
            Where data-protection law requires a legal basis (for example, under the GDPR), we rely on{" "}
            <b>performance of our contract with you</b> to provide the service you signed up for, and on our{" "}
            <b>legitimate interest</b> in keeping AnyLink secure and working.
          </P>
        </Section>

        <Section title="5. Google user data">
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

        <Section title="6. Who processes your information">
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
              <b>Anthropic</b>, with Pro, receives the text of web pages you save, so it can write a summary, suggest tags
              and structure the card. When you ask AnyLink to group your links, on any plan, Anthropic also receives the
              titles, domains and folder names of those links (for a chat, the words written around each link), and
              your answers about what matters to you. Your notes, images and account details are not sent to Anthropic.
              Under Anthropic&apos;s commercial terms, data sent through the API is not used to train its models.
            </li>
            <li>
              <b>Microlink</b> receives the address of a page that won&apos;t let our servers read it, so it can fetch
              the page&apos;s title and image instead.
            </li>
            <li>
              <b>Resend</b> delivers sign-in emails, so it receives your email address.
            </li>
            <li>
              <b>Google</b> and <b>Apple</b> handle the sign-in, if you choose them. <b>Apple</b> also handles payments
              for AnyLink Pro, and the App Attest device checks (section 2).
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

        <Section title="7. Images and link previews">
          <P>
            Images you upload, and preview images we copy from saved pages, are stored as files with a long, random
            address. Anyone who has that exact address can open the image, but the addresses are not listed or
            published anywhere. Don&apos;t save images you would not want viewable by someone you share the address
            with.
          </P>
        </Section>

        <Section title="8. Cookies and local storage">
          <P>
            The website uses one essential cookie, which keeps you signed in. It also uses your browser&apos;s local
            storage for your preferences (for example, theme and default collection) and for a guest&apos;s unsaved
            items. We do not use advertising or analytics cookies, so there is nothing to opt out of.
          </P>
        </Section>

        <Section title="9. On your iPhone">
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
              <b>Local library:</b> without Pro, your library lives on the device and in your iCloud (section 2).
            </li>
            <li>
              <b>Offline copy:</b> with Pro, a copy of your library and your images is kept on the device, so the app
              works offline. Signing out clears the library from the app; deleting the app removes everything it
              stored.
            </li>
          </Ul>
        </Section>

        <Section title="10. The Chrome extension">
          <P>The AnyLink extension for Chrome saves the tab you&apos;re on to your library. It needs an AnyLink account.</P>
          <Ul>
            <li>
              When you open it, it reads the title and address of the current tab, and loads your collections from
              AnyLink so you can pick one. It doesn&apos;t read the page itself, your other tabs or your browsing
              history.
            </li>
            <li>
              Nothing about the tab is sent until you click Save. Then its address and title go to your library, and
              our servers read the page as they do for any link you save (section 1).
            </li>
            <li>
              Your session (a sign-in token that renews itself, and your email address) is kept in Chrome&apos;s
              storage for the extension, on your computer. Signing out of the extension deletes it, and signs out only
              the extension.
            </li>
          </Ul>
        </Section>

        <Section title="11. How long we keep information">
          <P>
            We keep your account and library for as long as you have an account. Items you delete go to Trash, where
            they stay until you empty it or delete them permanently. When you delete your account, your account, your
            plan details, your entire library and your stored images are permanently deleted straight away. Deleting
            your account doesn&apos;t cancel a Pro subscription: Apple keeps billing it until you cancel it in your
            Apple Account&apos;s subscription settings. Our hosting provider&apos;s server logs and our database backups
            expire within 30 days.
          </P>
          <P>
            A local library stays on your devices and in your iCloud until you delete it. Deleting the app removes it
            from that device; you can remove the iCloud copy in your device&apos;s iCloud storage settings. App Attest
            records (section 2) aren&apos;t linked to you; we keep them so that later requests from the same app can be
            checked.
          </P>
        </Section>

        <Section title="12. Your choices and rights">
          <Ul>
            <li>
              <b>Access and correction:</b> everything in your library is visible and editable in the app.
            </li>
            <li>
              <b>Deletion:</b> delete individual items at any time. To delete your account and everything in it, go to{" "}
              <b>Settings → Delete account</b> on the website or in the iOS app, or email us.
            </li>
            <li>
              <b>Export:</b> with Pro, export your library as HTML, JSON or CSV from Settings. On any plan, email us and
              we will send you a copy of your data.
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

        <Section title="13. Security">
          <P>
            All traffic is encrypted with HTTPS. Data is encrypted at rest by our storage provider. Each request is
            checked against the signed-in account, so you can only ever read or change your own library. Sign-in
            sessions are stored in the iOS Keychain on iPhone, in a secure cookie on the web, and in the
            extension&apos;s own storage in Chrome. No system is perfectly secure; if a breach affects your data, we
            will notify you as the law requires.
          </P>
        </Section>

        <Section title="14. Children">
          <P>
            AnyLink is not directed at children under 13 (or under 16 where local law requires), and we do not
            knowingly collect their personal information. If you believe a child has given us personal information,
            contact us and we will delete it.
          </P>
        </Section>

        <Section title="15. Changes to this policy">
          <P>
            If we change this policy, we will update the date at the top of this page. If a change is significant, we
            will tell you in the app or by email before it takes effect.
          </P>
        </Section>

        <Section title="16. Contact">
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
