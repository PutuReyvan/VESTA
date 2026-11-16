import { useRef, useState } from 'react'
import arrowUpRight from '../assets/figma/arrow-up-right.svg'
import coinsStacked from '../assets/figma/coins-stacked.svg'
import currencyDollar from '../assets/figma/currency-dollar.svg'
import dashboardPreview from '../assets/figma/dashboard-preview.png'
import heroWaveOne from '../assets/figma/hero-wave-1.svg'
import heroWaveTwo from '../assets/figma/hero-wave-2.svg'
import heroWaveThree from '../assets/figma/hero-wave-3.svg'
import heroWaveFour from '../assets/figma/hero-wave-4.svg'
import peopleClaim from '../assets/figma/people-claim.png'
import playCircle from '../assets/figma/play-circle.svg'
import vestingFlowVideo from '../assets/vesting-flow.mp4'

type LandingPageProps = {
  onLaunch: () => void
}

const footerBars = [
  'figma-footer-bar-one',
  'figma-footer-bar-two',
  'figma-footer-bar-three',
  'figma-footer-bar-four',
  'figma-footer-bar-five',
  'figma-footer-bar-six',
  'figma-footer-bar-seven',
  'figma-footer-bar-eight',
]

export function LandingPage({ onLaunch }: LandingPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasStartedVideo, setHasStartedVideo] = useState(false)

  async function startWalkthrough() {
    setHasStartedVideo(true)

    try {
      await videoRef.current?.play()
    } catch {
      setHasStartedVideo(false)
    }
  }

  return (
    <main className="figma-landing">
      <section className="figma-hero" aria-labelledby="landing-title">
        <img className="figma-hero-wave figma-hero-wave-one" src={heroWaveOne} alt="" aria-hidden="true" />
        <img className="figma-hero-wave figma-hero-wave-two" src={heroWaveTwo} alt="" aria-hidden="true" />
        <img className="figma-hero-wave figma-hero-wave-three" src={heroWaveThree} alt="" aria-hidden="true" />
        <img className="figma-hero-wave figma-hero-wave-four" src={heroWaveFour} alt="" aria-hidden="true" />
        <div className="figma-hero-shade" aria-hidden="true" />

        <div className="figma-brand figma-brand-light" aria-label="VESTA">
          <span className="figma-brand-mark" aria-hidden="true" />
          <span>VESTA</span>
        </div>

        <div className="figma-hero-copy">
          <div>
            <h1 id="landing-title">Send tokens once.<br />Let them unlock over time.</h1>
            <p>Set up vesting for your whole team in one go. Each person claims their tokens as they unlock.</p>
          </div>
          <button type="button" className="figma-try-control" onClick={onLaunch}>
            <span>Try Vesta</span>
            <span className="figma-try-arrow"><img src={arrowUpRight} alt="" /></span>
          </button>
        </div>

        <img
          className="figma-dashboard-preview"
          src={dashboardPreview}
          alt="Preview of the VESTA dashboard"
        />
      </section>

      <section id="how-it-works" className="figma-walkthrough" aria-labelledby="walkthrough-title">
        <div className="figma-section-heading">
          <span>Get Started</span>
          <h2 id="walkthrough-title">How to use VESTA.</h2>
        </div>

        <div className={`figma-video-frame${hasStartedVideo ? ' is-started' : ''}`}>
          <video
            ref={videoRef}
            className="figma-video"
            controls={hasStartedVideo}
            playsInline
            preload="metadata"
            onEnded={() => setHasStartedVideo(false)}
          >
            <source src={vestingFlowVideo} type="video/mp4" />
            Your browser does not support HTML video.
          </video>
          <button
            type="button"
            className="figma-video-trigger"
            onClick={() => void startWalkthrough()}
            aria-label="Play the VESTA vesting flow tutorial"
          >
            <img src={playCircle} alt="" />
          </button>
        </div>
      </section>

      <section className="figma-steps" aria-labelledby="steps-title">
        <div className="figma-section-heading">
          <span>How It Works</span>
          <h2 id="steps-title">Three steps.</h2>
        </div>

        <div className="figma-steps-grid">
          <article className="figma-step-card figma-step-card-fund">
            <h3>Fund it</h3>
            <p>The admin adds the team and sends the tokens in one transaction.</p>
            <img className="figma-step-art figma-step-art-dollar" src={currencyDollar} alt="" aria-hidden="true" />
          </article>
          <article className="figma-step-card figma-step-card-locked">
            <h3>Tokens get locked</h3>
            <p>The contract holds everything, so the money is always there.</p>
            <img className="figma-step-art figma-step-art-coins" src={coinsStacked} alt="" aria-hidden="true" />
          </article>
          <article className="figma-step-card figma-step-card-claim">
            <h3>People claim</h3>
            <p>Each person takes what has unlocked, straight to their wallet.</p>
            <img className="figma-step-art figma-step-art-people" src={peopleClaim} alt="" aria-hidden="true" />
          </article>
        </div>
      </section>

      <section className="figma-final-cta" aria-labelledby="final-title">
        <div className="figma-footer-bars" aria-hidden="true">
          {footerBars.map((barName) => <span className={barName} key={barName} />)}
        </div>

        <div className="figma-brand figma-brand-blue" aria-label="VESTA">
          <span className="figma-brand-mark" aria-hidden="true" />
          <span>VESTA</span>
        </div>

        <div className="figma-final-copy">
          <div>
            <h2 id="final-title">Try it on the test network.</h2>
            <p>Connect MetaMask and walk through the whole flow.</p>
          </div>
          <button type="button" className="figma-try-control" onClick={onLaunch}>
            <span>Try Vesta</span>
            <span className="figma-try-arrow"><img src={arrowUpRight} alt="" /></span>
          </button>
        </div>
      </section>
    </main>
  )
}
