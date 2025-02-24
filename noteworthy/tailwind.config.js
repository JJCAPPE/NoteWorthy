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
              DEFAULT: "#FFFFFF", // Very dark gray (almost black)
              foreground: "#000000", // Light gray (almost white)
            },
            focus: "#000000", // Distinct dark shade for focus elements
          },
        },

        light: {
          colors: {
            primary: {
              DEFAULT: "#000000", // Nearly white with a soft hint of gray
              foreground: "#FFFFFF", // Very dark gray for text
            },
            focus: "#FFFFFF", // A distinct off-white shade for focus
          },
        },
      },
    }),
  ],
};
