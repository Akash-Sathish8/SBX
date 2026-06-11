module.exports = {
  content: ['./src/casey/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: { extend: {
    colors: {
      // Re-skinned to the SBX light theme. Token NAMES keep their semantic roles
      // (black/coal/carbon/smoke = surfaces, chalk = primary text, ash = borders,
      // fog/mist = muted text) but the VALUES are flipped light. Yellow is the SBX
      // brand hex; yellow-as-text is handled separately in casey.src.css.
      snap: { yellow:'#F7DF02', yellowDim:'#E0C400', black:'#FFFFFF', coal:'#FAFAF8', carbon:'#F2F2EE', smoke:'#ECECE6', ash:'#E2E2DA', fog:'#7A7A7A', mist:'#6A6A6A', chalk:'#141414' },
      live:'#E5202B', flight:'#B89500', upcoming:'#C9C9C0', done:'#E2E2DA',
    },
    fontFamily: {
      display:['"Anton"','"Oswald"','Impact','sans-serif'],
      body:['"Barlow"','system-ui','sans-serif'],
      mono:['"Barlow"','system-ui','sans-serif'],
    },
    keyframes: {
      'pulse-live':{'0%, 100%':{opacity:'1',transform:'scale(1)'},'50%':{opacity:'0.6',transform:'scale(1.15)'}},
      'pulse-flight':{'0%, 100%':{opacity:'1'},'50%':{opacity:'0.55'}},
      'arc-draw':{from:{strokeDashoffset:'1000'},to:{strokeDashoffset:'0'}},
      scanline:{'0%':{transform:'translateY(-100%)'},'100%':{transform:'translateY(100vh)'}},
    },
    animation: {
      'pulse-live':'pulse-live 1.5s ease-in-out infinite',
      'pulse-flight':'pulse-flight 2s ease-in-out infinite',
      'arc-draw':'arc-draw 2s ease-out forwards',
      scanline:'scanline 6s linear infinite',
    },
  } },
  plugins: [],
}
