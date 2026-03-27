import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin"

// Generujeme čas buildu (meniace sa číslo/dátum pri každom builde)
const buildDate = new Date().toLocaleString('sk-SK', { 
  year: 'numeric', month: '2-digit', day: '2-digit', 
  hour: '2-digit', minute: '2-digit' 
});

export default defineConfig({
  plugins: [react(), powerApps()],
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    assetsInlineLimit: 1000000, // Prinúti Vite vložiť obrázky (do 1MB) priamo do kódu v Base64
    rollupOptions: {
      output: {
        format: "iife",  // toto je kľúčové
        inlineDynamicImports: true,
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});