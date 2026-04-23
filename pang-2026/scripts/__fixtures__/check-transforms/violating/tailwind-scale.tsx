// PANG — check-transforms fixture. Tailwind `scale-125` is the
// utility-class flavour of the same 2018 regression. Not wired
// into the app.
export function BadTailwindScale(): JSX.Element {
  return <div className="scale-125">flat image pretending to zoom</div>;
}
