import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Code2, Globe2, Link2, MessagesSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { LandingPreview } from "@/components/landing-preview";
import { ShareGlobe } from "@/components/share-globe";

function sampleActivityLevel(index: number) {
  let value = Math.imul(index + 23, 0x45d9f3b);
  value ^= value >>> 16;
  return Math.abs(value) % 5;
}

export default async function Home() {
  const current = await viewer();
  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main">
        <section className="hero shell">
          <div className="hero-signal hero-signal-left" aria-hidden="true">
            {Array.from({ length: 42 }, (_, index) => <i key={index} data-level={sampleActivityLevel(index + 31)} />)}
          </div>
          <div className="hero-signal hero-signal-right" aria-hidden="true">
            {Array.from({ length: 42 }, (_, index) => <i key={index} data-level={sampleActivityLevel(index + 89)} />)}
          </div>
          <div className="hero-copy">
            <h1>Your agent work,<br /><em>made visible.</em></h1>
            <p>One public profile for the work you do with coding agents—measured locally, shared on your terms.</p>
          </div>
          <div className="hero-conversion">
            <div className="hero-actions">
              <Link className="button hero-cta" href={current?.onboarding_complete ? `/${current.handle}` : current ? "/onboarding" : "/register"}>
                {current ? "Open your profile" : "Create your activity field"} <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-proof">
              <span><Check size={14} /> Free in beta</span>
              <span><Check size={14} /> 60-second setup</span>
              <span><Check size={14} /> Metadata by default</span>
            </div>
          </div>
          <LandingPreview />
        </section>

        <section className="works-with" aria-label="Supported agent harnesses">
          <div className="shell">
            <span className="works-label">Works with</span>
            <div className="harness-list">
              <div className="harness-item"><Image className="harness-logo" src="/brands/opencode.svg" alt="" width={29} height={29} /><b>OpenCode</b></div>
              <div className="harness-item"><Image className="harness-logo" src="/brands/claude.svg" alt="" width={29} height={29} /><b>Claude Code</b></div>
              <div className="harness-item"><Image className="harness-logo" src="/brands/codex.svg" alt="" width={29} height={29} /><b>Codex</b></div>
              <div className="harness-item"><Image className="harness-logo" src="/brands/kimi.svg" alt="" width={29} height={29} /><b>Kimi Code</b></div>
            </div>
            <span className="works-note">More adapters are on the way <ArrowRight size={13} /></span>
          </div>
        </section>

        <section className="feature-showcase shell" aria-label="Agentprint features">
          <div className="feature-bento">
            <article className="feature-card feature-card-wide feature-connect">
              <div className="feature-copy">
                <h2>Connect once. Keep building.</h2>
                <p>A quiet local collector finds your coding agents and keeps your activity current.</p>
              </div>
              <div className="collector-visual" aria-hidden="true">
                <div className="collector-glow collector-glow-left" />
                <div className="collector-glow collector-glow-right" />
                <div className="collector-window">
                  <div className="visual-window-bar"><span /><span /><span /><b>agentprint collector</b><RefreshCw size={12} /></div>
                  <code><i>$</i> agentprint login</code>
                  <div className="collector-status"><span><i /> Codex</span><b>connected</b></div>
                  <div className="collector-status"><span><i /> Claude Code</span><b>connected</b></div>
                  <div className="collector-status"><span><i /> OpenCode</span><b>connected</b></div>
                  <div className="collector-status"><span><i /> Kimi Code</span><b>connected</b></div>
                </div>
                <div className="collector-sources">
                  <span><b><Image src="/brands/codex.svg" alt="" width={14} height={14} /></b>Codex</span>
                  <span><b><Image src="/brands/claude.svg" alt="" width={14} height={14} /></b>Claude</span>
                  <span><b><Image src="/brands/opencode.svg" alt="" width={14} height={14} /></b>OpenCode</span>
                  <span><b><Image src="/brands/kimi.svg" alt="" width={14} height={14} /></b>Kimi</span>
                </div>
              </div>
            </article>

            <article className="feature-card feature-privacy">
              <div className="feature-copy">
                <h2>Numbers in. Content out.</h2>
                <p>The contract cannot accept prompts, code, paths, or credentials.</p>
              </div>
              <div className="boundary-visual" aria-hidden="true">
                <div className="visual-window-bar"><span /><span /><span /><b>collection boundary</b><ShieldCheck size={12} /></div>
                <div><span>Token counts</span><b data-safe>accepted</b></div>
                <div><span>Agent + model</span><b data-safe>accepted</b></div>
                <div><span>Prompt text</span><b>never</b></div>
                <div><span>Source code</span><b>never</b></div>
                <div><span>Repository paths</span><b>never</b></div>
              </div>
            </article>

            <article className="feature-card feature-field">
              <div className="feature-copy">
                <h2>See the shape of your practice.</h2>
                <p>A year of agent-assisted work, distilled into one clear activity field.</p>
              </div>
              <div className="field-visual" aria-hidden="true">
                <div className="field-visual-top"><span>12 month trace</span><b>1.28B tokens</b></div>
                <div className="field-mini-grid">
                  {Array.from({ length: 98 }, (_, index) => <i key={index} data-level={(index * 17 + Math.floor(index / 7) * 11) % 5} />)}
                </div>
                <div className="field-visual-metrics"><span><b>212</b>active days</span><span><b>38</b>day streak</span></div>
              </div>
            </article>

            <article className="feature-card feature-card-wide feature-session">
              <div className="feature-copy">
                <h2>Publish a whole session. On purpose.</h2>
                <p>Background sync never uploads transcripts. Share one session deliberately—rendered locally first, credentials stripped.</p>
              </div>
              <div className="session-visual" aria-hidden="true">
                <div className="session-window">
                  <div className="visual-window-bar"><span /><span /><span /><b>agentprint share --dry-run</b><MessagesSquare size={12} /></div>
                  {/* Audit sits directly under the bar so the bottom bleed never clips it. */}
                  <div className="session-audit">
                    <span><ShieldCheck size={12} /> 2 secrets removed</span>
                    <span>7 paths rewritten</span>
                    <b>Nothing uploaded yet</b>
                  </div>
                  <div className="session-turn"><span>You</span><p>Make the sync client retry on 429.</p></div>
                  <div className="session-turn" data-agent><span>Claude Code</span><p>Added exponential backoff with a jittered delay, capped at five attempts.</p></div>
                  <div className="session-turn"><span>You</span><p>Read the token from <i>[redacted]</i> rather than the flag.</p></div>
                  <div className="session-turn" data-agent><span>Claude Code</span><p>Moved it behind a loader in <i>[project]</i>/internal/sync.</p></div>
                  <div className="session-turn"><span>You</span><p>Ship it.</p></div>
                </div>
                <div className="session-chip"><Link2 size={13} /> Unlisted link</div>
              </div>
            </article>
          </div>
        </section>

        <section className="global-section" aria-labelledby="global-title">
          <div className="shell global-heading">
            <span className="eyebrow">Made to travel</span>
            <h2 id="global-title">Your Agentprint.<br /><em>Out in the world.</em></h2>
            <p>Turn your agent activity into one public profile—ready to share anywhere.</p>
          </div>
          <div className="shell global-layout">
            <div className="global-benefits global-benefits-left">
              <article>
                <span><Link2 size={21} /></span>
                <h3>One public link</h3>
                <p>A profile that travels anywhere your work does.</p>
              </article>
              <article>
                <span><Globe2 size={21} /></span>
                <h3>Built for every timezone</h3>
                <p>Your activity stays true to your local day.</p>
              </article>
            </div>
            <div className="global-globe-wrap">
              <ShareGlobe />
            </div>
            <div className="global-benefits global-benefits-right">
              <article>
                <span><Code2 size={21} /></span>
                <h3>Live profile card</h3>
                <p>Embed an always-current Agentprint anywhere.</p>
              </article>
              <article>
                <span><ShieldCheck size={21} /></span>
                <h3>Share by choice</h3>
                <p>Publish only the metrics you want seen.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="open-source-section shell" aria-labelledby="open-source-title">
          <a
            className="open-source-card"
            href="https://github.com/afeefuddin/agentprint"
            target="_blank"
            rel="noreferrer"
          >
            <div className="open-source-mark" aria-hidden="true">
              <Image src="/brands/github.svg" alt="" width={42} height={42} />
            </div>
            <div className="open-source-copy">
              <span>Built in the open</span>
              <h2 id="open-source-title">Agentprint is open source.</h2>
              <p>Inspect the code, follow development, or make it better with us.</p>
            </div>
            <div className="open-source-repo">
              <Image src="/brands/github.svg" alt="" width={18} height={18} />
              <span>afeefuddin/agentprint</span>
              <ArrowRight size={17} />
            </div>
          </a>
        </section>

        <section className="claim-section">
          <div className="shell claim-layout">
            <div className="claim-copy">
              <h2>Claim your<br />Agentprint.</h2>
              <p>One link for the work your agents help you do.</p>
              <Link className="claim-action" href="/register">Create yours <ArrowRight size={17} /></Link>
            </div>
            <div className="claim-pattern" aria-hidden="true">
              {Array.from({ length: 48 }, (_, index) => <i key={index} data-level={sampleActivityLevel(index + 151)} />)}
            </div>
            <div className="claim-profile" aria-hidden="true">
              <div className="claim-url"><span>agentprint.tech/</span><b>you</b><i>Available</i></div>
              <div className="claim-person"><span>AP</span><div><b>Your Agentprint</b><small>@you</small></div><i><span /> Live</i></div>
              <div className="claim-trace">
                {Array.from({ length: 98 }, (_, index) => <i key={index} data-level={sampleActivityLevel(index)} />)}
              </div>
              <div className="claim-stats"><span><small>Lifetime tokens</small><b>—</b></span><span><small>Active days</small><b>01</b></span><span><small>Current streak</small><b>01d</b></span></div>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell"><span>agentprint</span><p>Your proof of work in the agent era.</p><span>© 2026</span></div>
      </footer>
    </>
  );
}
