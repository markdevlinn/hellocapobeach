// Shared by the page shell (server) and the light and dark switch (browser).
export const THEME_KEY = "hcb_theme";

/** Runs before the page paints so a saved choice never flashes the wrong colors. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
