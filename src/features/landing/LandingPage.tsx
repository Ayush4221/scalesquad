import { landingClassName } from './landingStyles';
import Link from 'next/link';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { RoleExplorer } from './RoleExplorer';
import { GameWalkthrough } from './GameWalkthrough';
import { HomeAction } from './HomeAction';

export function LandingPage() {
  return (
    <div className={landingClassName('hallmarkHome')}>
      <a className={landingClassName('hm-skip')} href="#qa-top" tabIndex={0}>
        Skip to content
      </a>
      <header className={landingClassName('hm-container hm-nav')}>
        <BrandLogo href="/" />
        <nav aria-label="Main navigation" className={landingClassName('hm-main-nav')}>
          <a href="#qa-mission">The mission</a>
          <a href="#qa-how">How to play</a>
          <Link href="/signin" className={landingClassName('hm-link')}>
            Sign in
          </Link>
        </nav>
      </header>
      <main id="qa-top" tabIndex={-1}>
        <section className={landingClassName('hm-container hm-hero')} aria-labelledby="home-title">
          <div className={landingClassName('hm-opening')}>
            <h1
              id="home-title"
              aria-label="Think as a squad."
              className={landingClassName('hm-headline')}
            >
              Think as
              <br />a squad.
            </h1>
            <p className={landingClassName('hm-lede')}>
              A system design game for three engineers with different private clues.
            </p>
            <div className={landingClassName('hm-actions')}>
              <HomeAction />
              <a href="#qa-mission" className={landingClassName('hm-link')}>
                Explore CampusPass
              </a>
            </div>
          </div>
          <RoleExplorer />
        </section>
        <section
          id="qa-mission"
          className={landingClassName('hm-mission')}
          aria-labelledby="mission-title"
        >
          <div className={landingClassName('hm-container hm-mission-layout')}>
            <div>
              <h2 id="mission-title">
                One pass.
                <br />
                One admission.
              </h2>
              <p>
                CampusPass handles festival check-ins. Your squad repairs a system under pressure.
              </p>
            </div>
            <dl className={landingClassName('hm-objectives')}>
              <div>
                <dt>Correctness</dt>
                <dd>Protect single-use passes.</dd>
              </div>
              <div>
                <dt>Throughput</dt>
                <dd>Keep the gates moving.</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>Stay within the budget.</dd>
              </div>
            </dl>
          </div>
        </section>
        <section
          id="qa-how"
          className={landingClassName('hm-container hm-round')}
          aria-labelledby="round-title"
        >
          <div className={landingClassName('hm-round-heading')}>
            <h2 id="round-title">
              The next run
              <br />
              gets the last word.
            </h2>
            <p>Follow the squad from its first clue to its next test.</p>
          </div>
          <GameWalkthrough />
        </section>
        <section
          className={landingClassName('hm-container hm-close')}
          aria-labelledby="ready-title"
        >
          <h2 id="ready-title">
            Bring two people
            <br />
            who challenge your thinking.
          </h2>
          <HomeAction secondary />
        </section>
      </main>
      <footer className={landingClassName('hm-container hm-footer')}>
        <span>ScaleSquad</span>
        <p>Build together. Prove it together.</p>
        <a href="#qa-top">Back to top</a>
      </footer>
    </div>
  );
}
