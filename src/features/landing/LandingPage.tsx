import { commonStrings } from '@/constants/strings/common';
import { landingStrings } from '@/constants/strings/landing';
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
        {landingStrings.skipToContent}
      </a>
      <header className={landingClassName('hm-container hm-nav')}>
        <BrandLogo href="/" />
        <nav aria-label={landingStrings.mainNavigation} className={landingClassName('hm-main-nav')}>
          <a href="#qa-mission">{landingStrings.theMission}</a>
          <a href="#qa-how">{landingStrings.howToPlay}</a>
          <Link href="/signin" className={landingClassName('hm-link')}>
            {commonStrings.signIn}
          </Link>
        </nav>
      </header>
      <main id="qa-top" tabIndex={-1}>
        <section className={landingClassName('hm-container hm-hero')} aria-labelledby="home-title">
          <div className={landingClassName('hm-opening')}>
            <h1
              id="home-title"
              aria-label={landingStrings.thinkAsASquad}
              className={landingClassName('hm-headline')}
            >
              {landingStrings.thinkAs}
              <br />
              {landingStrings.aSquad}
            </h1>
            <p className={landingClassName('hm-lede')}>
              {landingStrings.aSystemDesignGameForThree}
            </p>
            <div className={landingClassName('hm-actions')}>
              <HomeAction />
              <a href="#qa-mission" className={landingClassName('hm-link')}>
                {landingStrings.exploreCampuspass}
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
                {landingStrings.onePass}
                <br />
                {landingStrings.oneAdmission}
              </h2>
              <p>{landingStrings.campuspassHandlesFestivalCheckInsYour}</p>
            </div>
            <dl className={landingClassName('hm-objectives')}>
              <div>
                <dt>{commonStrings.correctness}</dt>
                <dd>{commonStrings.protectSingleUsePasses}</dd>
              </div>
              <div>
                <dt>{landingStrings.throughput}</dt>
                <dd>{commonStrings.keepTheGatesMoving}</dd>
              </div>
              <div>
                <dt>{landingStrings.cost}</dt>
                <dd>{landingStrings.stayWithinTheBudget}</dd>
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
              {landingStrings.theNextRun}
              <br />
              {landingStrings.getsTheLastWord}
            </h2>
            <p>{landingStrings.followTheSquadFromItsFirst}</p>
          </div>
          <GameWalkthrough />
        </section>
        <section
          className={landingClassName('hm-container hm-close')}
          aria-labelledby="ready-title"
        >
          <h2 id="ready-title">
            {landingStrings.bringTwoPeople}
            <br />
            {landingStrings.whoChallengeYourThinking}
          </h2>
          <HomeAction secondary />
        </section>
      </main>
      <footer className={landingClassName('hm-container hm-footer')}>
        <span>{commonStrings.scalesquad}</span>
        <p>{landingStrings.buildTogetherProveItTogether}</p>
        <a href="#qa-top">{landingStrings.backToTop}</a>
      </footer>
    </div>
  );
}
