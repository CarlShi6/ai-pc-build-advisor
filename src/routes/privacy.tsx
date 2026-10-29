import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · AIPC" },
      { name: "description", content: "What happens to your photo and your builds in AIPC." },
    ],
  }),
  component: PrivacyPage,
});

// Every statement here describes what the code does (docs/DEPLOY.md, Stage 2 item 7). Change
// the page together with the code it describes.
function PrivacyPage() {
  return (
    <V3Shell>
      <main className="v3-page v3-privacy-page">
        <div className="v3-page-intro">
          <span className="v3-icon">
            <ShieldCheck size={25} />
          </span>
          <span className="v3-kicker">PRIVACY</span>
          <h1>Your photo and your builds</h1>
          <p>What AIPC does with a photo you analyze, and where your builds are kept.</p>
        </div>

        <section aria-labelledby="privacy-photo">
          <h2 id="privacy-photo">The photo is never stored</h2>
          <ul>
            <li>
              Choosing a photo does nothing on its own. Nothing is sent until you click Analyze.
            </li>
            <li>
              Your browser makes a resized copy (at most 1600 pixels on the long side) by redrawing
              the image, which leaves out its metadata such as location and camera details. The
              server strips any remaining metadata again before the copy goes anywhere.
            </li>
            <li>
              AIPC never stores the original photo, the resized copy or the file name, on the server
              or in your browser. The original stays in the open tab only.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-provider">
          <h2 id="privacy-provider">What the analysis provider receives</h2>
          <ul>
            <li>
              The resized copy and our fixed instructions go to OpenAI's API to read what is
              visible. No name, email, account or file name is sent with it.
            </li>
            <li>
              The request is sent with OpenAI's response storage turned off. OpenAI's own API data
              policies still apply; see{" "}
              <a
                href="https://openai.com/policies/privacy-policy/"
                target="_blank"
                rel="noreferrer"
              >
                OpenAI's privacy policy
              </a>
              .
            </li>
            <li>
              What comes back is text: visible looks, guesses and readable text. It stays in this
              tab's draft and is kept with a build only if you save it.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-builds">
          <h2 id="privacy-builds">Where your builds are kept</h2>
          <ul>
            <li>
              Saved builds stay in this browser's local storage. There are no accounts, and builds
              are not uploaded. Another browser or device won't see them, and clearing this site's
              data deletes them.
            </li>
            <li>
              The draft you are working on is kept in this tab's session storage until you close it.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-limits">
          <h2 id="privacy-limits">Limits, checks and usage counts</h2>
          <ul>
            <li>
              To limit misuse, Analyze sets a cookie with a random session id (it expires after 24
              hours) and may show a Cloudflare Turnstile check. The server keeps only a count of
              analyses per day, with no photo and no identity.
            </li>
            <li>
              The app records product events, such as "analysis completed", with counts and fixed
              codes (for example which part categories were visible, or why a part had no match), a
              random id for this tab session and any campaign tags in the link you came from. They
              never contain the photo, the analysis text, part names or anything you typed.
            </li>
            <li>
              The site is served by Cloudflare, which processes requests to deliver it, and loads
              its fonts from Google Fonts.
            </li>
          </ul>
        </section>
      </main>
    </V3Shell>
  );
}
