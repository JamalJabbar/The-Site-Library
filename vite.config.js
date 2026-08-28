import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules\/three\// },
            { name: "motion", test: /node_modules\/(gsap|lenis)\// }
          ]
        }
      }
    }
  }
});
