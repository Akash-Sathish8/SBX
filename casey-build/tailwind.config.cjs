module.exports = {
  content: ['./src/casey/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: { extend: {
    colors: {
      snap: { yellow:'#FFD400', yellowDim:'#C9A900', black:'#000000', coal:'#0A0A0A', carbon:'#141414', smoke:'#1F1F1F', ash:'#2A2A2A', fog:'#6E6E6E', mist:'#8A8A8A', chalk:'#E8E8E8' },
      live:'#FF3838', flight:'#FFD400', upcoming:'#4A4A4A', done:'#2A2A2A',
    },
    fontFamily: {
      display:['"Bebas Neue"','"Oswald"','Impact','sans-serif'],
      body:['"Inter"','system-ui','sans-serif'],
      mono:['"JetBrains Mono"','"Courier New"','monospace'],
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
