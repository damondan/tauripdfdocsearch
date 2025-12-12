import type { Config } from 'tailwindcss';

export default {
	theme: {
		extend: {
			keyframes: {
				spin: {
					'0%': { transform: 'rotate(0deg)' },
					'100%': { transform: 'rotate(360deg)' }
				}
			},
			animation: {
				spin: 'spin 1s linear infinite'
			}
		}
	}
} satisfies Config;
