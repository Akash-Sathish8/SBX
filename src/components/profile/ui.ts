// Shared Tailwind class strings for the profile surfaces — the former .pf-*
// rules from pages/profile.css, kept in one place so /profile, /feed and
// /u/$username stay identical. Colors are the literals profile.css resolved
// (--k #222, --ink #222, --gray #6b6b6b, --y #F7DF02).

import { cva } from 'class-variance-authority'

// The brand notch button (.pf-edit/.pf-save/.pf-follow): apply over
// <Button variant="brand">. The clip-path cuts the ticket notch; the drop-shadow
// filter is the hard offset shadow, pressed flat on :active. `tone: 'dark'` is the
// ink/yellow signout variant, `tone: 'ghost'` the grey mini; `size: 'mini'` shrinks it.
export const notchButton = cva(
  "h-auto rounded-none px-[18px] py-[10px] text-[13px] font-extrabold tracking-[.6px] [clip-path:polygon(calc(100%_-_10px)_0px,100%_10px,100%_100%,10px_100%,0px_calc(100%_-_10px),0px_0px)] [filter:drop-shadow(4px_4px_0_#000)] [transition:transform_80ms,filter_120ms] hover:brightness-100 active:[transform:translate(2px,2px)] active:[filter:drop-shadow(2px_2px_0_#000)]",
  {
    variants: {
      tone: {
        default: "",
        dark: "!bg-[#2c2c2c] !text-white [filter:drop-shadow(4px_4px_0_#F7DF02)] active:[filter:drop-shadow(2px_2px_0_#F7DF02)]",
        ghost: "!bg-[#e7e7e7] !text-[#222] [filter:drop-shadow(3px_3px_0_#bbb)] active:[filter:drop-shadow(2px_2px_0_#bbb)]",
      },
      size: {
        default: "",
        mini: "px-[14px] py-[8px] text-[12px]",
      },
    },
    defaultVariants: { tone: "default", size: "default" },
  },
)

// .pf-edit-mini — small yellow text button (over <Button variant="link">).
export const editMini =
  "h-auto bg-transparent p-0 text-[12px] font-extrabold uppercase tracking-[.5px] !text-[#b58900] no-underline hover:!text-[#111] hover:bg-transparent hover:no-underline"

// section chrome
export const block = "mb-[34px]"
export const blockHead = "mb-[14px] flex items-center justify-between gap-[12px]"
export const blockH2 = "flex items-center gap-[10px] font-display text-[22px] uppercase leading-none tracking-[1px] text-[#222]"
export const count = "rounded-[20px] border-2 border-[#111] bg-brand px-[10px] py-px font-sans text-[13px] font-extrabold text-[#111]"
export const empty = "px-[2px] py-[12px] text-[15px] font-semibold text-[#6b6b6b]"
// the hard-shadow white card shared by diary / stat / review / feed rows
export const card = "rounded-[8px] border-[3px] border-[#222] bg-white shadow-[5px_5px_0_#222]"
export const container = "mx-auto px-[clamp(28px,4vw,72px)] max-[520px]:px-[18px]"
