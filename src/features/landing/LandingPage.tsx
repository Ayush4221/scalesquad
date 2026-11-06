import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Crosshair,
  Database,
  MessageSquare,
  RadioTower,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { LandingAction } from './LandingAction';
import { MissionPreview } from './MissionPreview';
import styles from './landing.module.css';

const playbook = [
  {
    number: '01',
    icon: Users,
    title: 'Gather your squad',
    description:
      'Create a room and invite two teammates. Three different roles. One shared challenge.',
  },
  {
    number: '02',
    icon: MessageSquare,
    title: 'Trade what you know',
    description:
      'Read your private brief. Share the facts that could change your squad’s decision.',
  },
  {
    number: '03',
    icon: Wrench,
    title: 'Repair. Run. Compare.',
    description:
      'Choose a repair, test it against the incident, and explain what actually improved.',
  },
] as const;

const roles = [
  {
    icon: RadioTower,
    title: 'Traffic',
    description: 'Read the surge. Understand the pressure on your system.',
  },
  {
    icon: Database,
    title: 'Data',
    description: 'Protect every pass. Find the correctness risks in the design.',
  },
  {
    icon: Settings,
    title: 'Operations',
    description: 'Own the trade-offs. Keep the system reliable and within budget.',
  },
] as const;

export function LandingPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#home-main" tabIndex={0}>
        Skip to content
      </a>
      <header className={styles.header}>
        <BrandLogo href="/" />
        <nav className={styles.navigation} aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#your-roles">Your roles</a>
          <Link href="/signin" className={styles.signIn}>
            Sign in <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </header>
      <main id="home-main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <Crosshair aria-hidden="true" /> THREE PLAYERS. ONE SHARED INCIDENT.
            </p>
            <h1
              id="home-title"
              className={styles.heading}
              aria-label="System under load. Squad up."
            >
              <span>System</span>
              <span>under load.</span>
              <span className={styles.headingAccent}>Squad up.</span>
            </h1>
            <p className={styles.description}>
              ScaleSquad is a three-player system design game. Trade private clues, repair a failing
              system, and prove your fix works together.
            </p>
            <div className={styles.heroActions}>
              <LandingAction />
              <a className={styles.explore} href="#how-it-works">
                See how it works <ArrowRight aria-hidden="true" />
              </a>
            </div>
            <p className={styles.signupNote}>Start with an account. Bring two teammates.</p>
            <div className={styles.heroPrinciples} aria-label="Your squad’s goals">
              <span>
                <ShieldCheck aria-hidden="true" /> One admission per pass
              </span>
              <span>
                <Zap aria-hidden="true" /> Survive the surge
              </span>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <MissionPreview />
          </div>
        </section>
        <section id="how-it-works" className={styles.playbook} aria-labelledby="playbook-title">
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>YOUR PLAYBOOK</p>
              <h2 id="playbook-title">Every clue needs a teammate.</h2>
            </div>
            <p>
              Good instincts start the conversation.
              <br />
              The next run puts them to the test.
            </p>
          </div>
          <ol className={styles.steps}>
            {playbook.map(({ number, icon: Icon, title, description }) => (
              <li className={styles.step} key={number}>
                <div className={styles.stepTop}>
                  <Icon aria-hidden="true" />
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className={styles.stepLine} aria-hidden="true" />
              </li>
            ))}
          </ol>
        </section>
        <section id="your-roles" className={styles.rolesSection} aria-labelledby="roles-title">
          <div className={styles.rolesIntro}>
            <p className={styles.eyebrow}>THREE PERSPECTIVES</p>
            <h2 id="roles-title">
              Nobody has
              <br />
              the whole picture.
            </h2>
            <p>
              Each engineer gets a private brief. Your team finds the answer by connecting what you
              know.
            </p>
            <span className={styles.roleNote}>Roles reveal when the match begins.</span>
          </div>
          <div className={styles.roles}>
            {roles.map(({ icon: Icon, title, description }) => (
              <article className={styles.role} key={title}>
                <span className={styles.roleIcon}>
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.finalCall} aria-labelledby="ready-title">
          <div>
            <span className={styles.missionLabel}>
              <Ticket aria-hidden="true" /> FIRST MISSION / CAMPUSPASS
            </span>
            <h2 id="ready-title">
              Good instincts.
              <br />
              <em>Better proof.</em>
            </h2>
            <p>Bring your squad. Take on the incident.</p>
          </div>
          <div className={styles.finalActions}>
            <LandingAction label="Start your first incident" />
            <p>
              Already have an account?{' '}
              <Link href="/signin">
                Sign in <ArrowUpRight aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <BrandLogo href="/" />
        <p>Build together. Prove it together.</p>
        <a href="#home-main">
          Back to top <ArrowUpRight aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
