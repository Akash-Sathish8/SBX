export function SaveRankingsPrompt({ onCreate, onDismiss }: { onCreate: () => void; onDismiss: () => void }) {
  return (
    <div
      className="mb-6 bg-brand-yellow border-[3px] border-[#222] shadow-[4px_4px_0_#222] rounded-[8px] p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
      role="status"
    >
      <div className="flex-1">
        <div className="font-display text-[15px] uppercase tracking-[0.5px] text-ink mb-0.5">Save your rankings</div>
        <div className="font-body text-[13px] text-[#444]">Create a free account so your rankings follow you to any device.</div>
      </div>
      <div className="flex gap-3 shrink-0 items-center">
        <button
          onClick={onCreate}
          className="bg-ink text-white font-display text-[12px] uppercase tracking-[0.5px] px-4 py-2 border-[2px] border-[#222] shadow-[3px_3px_0_#222] hover:-translate-y-px [transition:transform_.1s,box-shadow_.1s] cursor-pointer hover:shadow-[4px_4px_0_#222]"
        >
          Create account
        </button>
        <button onClick={onDismiss} className="font-body text-[13px] text-[#555] underline cursor-pointer bg-transparent border-0">
          Maybe later
        </button>
      </div>
    </div>
  )
}
