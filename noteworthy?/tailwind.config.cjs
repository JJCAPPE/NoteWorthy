import { heroui } from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)"],
                mono: ["var(--font-mono)"],
            },
        },
    },
    darkMode: "class",
    plugins: [heroui({
        themes: {
            dark: {
                colors: {
                    primary: {
                        DEFAULT: "#F5BCC4",
                        foreground: "#F4F3ED",
                    },
                    secondary: {
                        DEFAULT: "#15A1C2",
                        foreground: "#F4F3ED",
                    },
                    focus: "#D57CB6",

                },
            },
            light: {
                colors: {
                    primary: {
                        DEFAULT: "#146C86",
                        foreground: "#F4F3ED",
                    },
                    secondary: {
                        DEFAULT: "#F5BCC4",
                        foreground: "#F4F3ED",
                    },
                    focus: "#15A1C2",
                },
            }
        }
    })],
}