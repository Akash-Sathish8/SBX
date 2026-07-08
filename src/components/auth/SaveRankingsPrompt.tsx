// Inline nudge shown on /rank after a signed-out fan adds a ranking. The cadence
// (first add, then every few) is owned by rank.tsx; this is just the card.
export function SaveRankingsPrompt({ onCreate, onDismiss }: { onCreate: () => void; onDismiss: () => void }) {
  return (
    <div className="sbx-saveprompt" role="status">
      <div className="sbx-sp-copy">
        <strong>Save your rankings</strong>
        <span>Create a free account so your rankings follow you to any device.</span>
      </div>
      <div className="sbx-sp-actions">
        <button className="sbx-sp-go" onClick={onCreate}>Create account</button>
        <button className="sbx-sp-later" onClick={onDismiss}>Maybe later</button>
      </div>
    </div>
  )
}
