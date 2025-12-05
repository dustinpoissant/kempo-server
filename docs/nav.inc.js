document.getElementById('toggleNavSideMenu').addEventListener('click', async () => {
	await window.customElements.whenDefined('k-side-menu');
	document.getElementById('navSideMenu').toggle();
});
document.addEventListener('click', function(e) {
	if (e.target.matches('a[href^="#"]')) {
		e.preventDefault();
		const targetId = e.target.getAttribute('href').replace('#', '');
		const target = document.getElementById(targetId);
		if (target) {
			target.scrollIntoView({ behavior: 'smooth' });
			const url = window.location.pathname + window.location.search + '#' + targetId;
			history.replaceState(null, '', url);
		}
	}
});