export default {
	customRoutes: {
		"media/*": "../docs/media/*",
		"theme.css": "../docs/theme.css",
		"manifest.json": "../docs/manifest.json"
	},
	templating: {
    ssr: true,
    ssrPriority: true
  }
};