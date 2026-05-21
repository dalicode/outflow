/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'theme-background': 'rgb(var(--theme-background-rgb) / <alpha-value>)',
        'theme-surface': 'rgb(var(--theme-surface-rgb) / <alpha-value>)',
        'theme-primary': 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        'theme-secondary': 'rgb(var(--theme-secondary-rgb) / <alpha-value>)',
        'theme-warning': 'rgb(var(--theme-warning-rgb) / <alpha-value>)',
        'theme-text': 'rgb(var(--theme-text-rgb) / <alpha-value>)',
        'theme-muted': 'rgb(var(--theme-muted-rgb) / <alpha-value>)',
        'theme-border': 'rgb(var(--theme-border-rgb) / <alpha-value>)',
        'theme-danger': 'rgb(var(--theme-danger-rgb) / <alpha-value>)',
        'theme-success': 'rgb(var(--theme-success-rgb) / <alpha-value>)',
        'theme-primary-subtle': 'rgb(var(--theme-primary-rgb) / 0.05)',
        'theme-primary-muted': 'rgb(var(--theme-primary-rgb) / 0.1)',
        'theme-danger-subtle': 'rgb(var(--theme-danger-rgb) / 0.05)',
        'theme-danger-muted': 'rgb(var(--theme-danger-rgb) / 0.1)',
        'theme-success-subtle': 'rgb(var(--theme-success-rgb) / 0.05)',
        'theme-warning-subtle': 'rgb(var(--theme-warning-rgb) / 0.05)',
        'theme-warning-muted': 'rgb(var(--theme-warning-rgb) / 0.1)',
        'theme-background-muted': 'rgb(var(--theme-background-rgb) / 0.8)',
        'theme-background-semi': 'rgb(var(--theme-background-rgb) / 0.5)',
        'theme-background-solid': 'rgb(var(--theme-background-rgb) / 0.95)',
        'theme-muted-subtle': 'rgb(var(--theme-muted-rgb) / 0.1)',
      },
    },
  },
  plugins: [],
}
