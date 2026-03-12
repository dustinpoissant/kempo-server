const main = document.getElementById("main");

const loadPage = path => {
	const page = (path === "/" || path === "/index.html")
		? "/pages/index.html"
		: `/pages${path}`;
	fetch(page)
		.then(r => {
			if(!r.ok) throw new Error(r.status);
			return r.text();
		})
		.then(html => {
			main.innerHTML = html;
		})
		.catch(() => {
			main.innerHTML = "<h1>Page Not Found</h1>";
		});
};

document.addEventListener("click", e => {
	const a = e.target.closest("a");
	if(!a || a.origin !== location.origin) return;
	e.preventDefault();
	history.pushState(null, "", a.href);
	loadPage(a.pathname);
});

window.addEventListener("popstate", () => {
	loadPage(location.pathname);
});

loadPage(location.pathname);
