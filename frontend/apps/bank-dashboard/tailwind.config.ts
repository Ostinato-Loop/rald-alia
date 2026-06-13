import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        foreground: '#FAFAFA',
        surface: '#131313',
        'surface-2': '#1C1C1C',
        hairline: 'rgba(255,255,255,0.08)',
        signal: '#D90429',
        'signal-foreground': '#FAFAFA',
        titanium: '#B8BCC8',
        success: '#34D399',
        warning: '#FBBF24',
        info: '#60A5FA',
        'muted-foreground': '#A0A0B0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.09)',
        hairline: 'rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
