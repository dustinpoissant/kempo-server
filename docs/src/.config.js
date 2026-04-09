export default {
	customRoutes: {
		"media/*": "../dist/media/*",
		"theme.css": "../dist/theme.css",
		"manifest.json": "../dist/manifest.json"
	},
	templating: {
    ssr: true,
    ssrPriority: true
  }
};