// tailwind.config.js
const { heroui } = require("@heroui/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./node_modules/@heroui/theme/dist/components/(button|card|code|input|kbd|link|listbox|navbar|snippet|toggle|ripple|spinner|form|divider|popover).js",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            primary: {
              DEFAULT: "#1C1C1C", // Very dark gray (almost black)
              foreground: "#EDEDED", // Light gray (almost white)
            },
            secondary: {
              DEFAULT: "#2A2A2A", // A bit lighter than primary's background
              foreground: "#DADADA", // Slightly darker light gray for contrast
            },
            focus: "#333333", // Distinct dark shade for focus elements
            warning: {
              DEFAULT: "#262626", // A unique shade for warnings, slightly brighter than primary
              foreground: "#F0F0F0", // A light gray for text to ensure good contrast
            },
          },
        },

        light: {
          colors: {
            primary: {
              DEFAULT: "#F8F8F8", // Nearly white with a soft hint of gray
              foreground: "#1C1C1C", // Very dark gray for text
            },
            secondary: {
              DEFAULT: "#F0F0F0", // A slightly warmer off-white
              foreground: "#2A2A2A", // Darker gray for text contrast
            },
            warning: {
              DEFAULT: "#E8E8E8", // A subtle, muted light gray
              foreground: "#333333", // Dark gray for clarity on warning elements
            },
            focus: "#DFDFDF", // A distinct off-white shade for focus
          },
        },
      },
    }),
  ],
};
