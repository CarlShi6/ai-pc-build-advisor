import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use · AIPC" },
      { name: "description", content: "The terms for using AIPC and what its results mean." },
    ],
  }),
  component: TermsPage,
});

// Like /privacy, every statement describes what the app does; change it with the code.
// The operator can change CONTACT_EMAIL at any time; deploy:check refuses a placeholder.
const OPERATOR = "AIPC (AI PC Build Advisor), operated by Jiahao Shi";
const CONTACT_EMAIL = "carlshi617@gmail.com";
function TermsPage() {
  return (
    <V3Shell>
      <main className="v3-page v3-privacy-page">
        <div className="v3-page-intro">
          <span className="v3-icon">
            <FileText size={25} />
          </span>
          <span className="v3-kicker">TERMS</span>
          <h1>Terms of use</h1>
          <p>
            AIPC is a free preview that helps you plan a PC build. These terms are between you and{" "}
            {OPERATOR}. By using it you agree to them.
          </p>
        </div>

        <section aria-labelledby="terms-photos">
          <h2 id="terms-photos">Photos you analyze</h2>
          <ul>
            <li>
              Only analyze a photo you are allowed to use. A reference photo can be someone else's
              work; analyzing it here does not give you any right to copy or share it.
            </li>
            <li>
              Photos must show a desktop PC or PC hardware. Photos that are not of a PC, or that the
              moderation check refuses, are not read; an unclear photo is read with a warning.
            </li>
            <li>
              How a photo is handled is described in the <Link to="/privacy">privacy notes</Link>.
            </li>
          </ul>
        </section>

        <section aria-labelledby="terms-results">
          <h2 id="terms-results">What the results mean</h2>
          <ul>
            <li>
              Photo readings, model guesses and recommendations are estimates made by software,
              including an AI model. They can be wrong. A part is only in your build when you choose
              it.
            </li>
            <li>
              Compatibility covers only the rules the app checks with catalog specs. It does not
              confirm physical fit, and empty or unresolved slots are not checked.
            </li>
            <li>
              Prices are catalog values or manufacturer store prices with the date they were
              checked, not live quotes. Tax, shipping and stock are not included. Check with the
              seller before you buy.
            </li>
            <li>The 3D view is an illustration of the build, not an exact model of any product.</li>
          </ul>
        </section>

        <section aria-labelledby="terms-links">
          <h2 id="terms-links">Other sites and brands</h2>
          <ul>
            <li>
              Links go only to a fixed list of manufacturer and retailer sites, and open in a new
              tab. Those sites have their own terms; AIPC does not sell anything and earns nothing
              from these links.
            </li>
            <li>
              Product and brand names belong to their owners. AIPC is not affiliated with or
              endorsed by them.
            </li>
          </ul>
        </section>

        <section aria-labelledby="terms-use">
          <h2 id="terms-use">Fair use and availability</h2>
          <ul>
            <li>
              Photo analysis has limits per browser session, per network and per day, and may be
              paused at any time. Do not try to get around these limits, automate requests, or
              interfere with the service.
            </li>
            <li>
              The service is provided as is, without warranties, and may change or stop. Your saved
              builds are kept only in your browser, so keep a copy of anything you need.
            </li>
          </ul>
        </section>

        <section aria-labelledby="terms-contact">
          <h2 id="terms-contact">Operator, contact and law</h2>
          <ul>
            <li>{OPERATOR}.</li>
            <li>
              Questions about these terms:{" "}
              <a data-contact href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </li>
            <li>These terms are governed by the laws of the State of California, USA.</li>
          </ul>
        </section>
      </main>
    </V3Shell>
  );
}
