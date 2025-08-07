// Injects the floating coffee donation popup and button into the page
// Inject coffee.css if not already present
if (!document.querySelector('link[href*="coffee.css"]')) {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = 'coffee.css?v=1.0.0';
	document.head.appendChild(link);
}

(function () {
	const popupHTML = `
	<div id="coffee-overlay" class="coffee-overlay" style="display:none;">
	  <div class="coffee-popup">
		<button class="coffee-close" onclick="closeCoffeePopup()" title="Close">&times;</button>
		<h2>Hi there :)</h2>
		<p>I hope you enjoy what you see on this page!<br><br>
		  If you'd like to support my work, consider buying me an espresso (or two), because caffeine keeps the code alive :D<br><br>
		  You can either send a digital espresso to this Ethereum address or use the link to BuyMeACoffee below.
		</p>
		<div class="coffee-address-box">
		  <span id="coffee-address">0x706323F0225a7a0434B418dFA1fF25d9B90103C9</span>
		  <button class="copy-address-btn" onclick="copyCoffeeAddress()" title="Copy to clipboard">
			<i class="fa-regular fa-copy"></i>
		  </button>
		</div>
		<div id="copy-success" class="copy-success" style="display:none;">Copied!</div>
		<a href="https://coff.ee/golgoin" target="_blank" class="coffee-buy-btn">
		  <img src="/static/shared/black-button-removebg-preview.png" alt="Buy me a coffee" style="height:40px;" />
		</a>
	  </div>
	</div>
	<a href="#" class="floating-coffee-btn" title="Buy me a coffee" onclick="openCoffeePopup(event)">
	  <img src="/static/shared/black-button-removebg-preview.png" alt="Buy me a coffee" />
	</a>
  `;

	function injectPopup() {
		// Only inject if not already present
		if (!document.getElementById('coffee-overlay')) {
			document.body.insertAdjacentHTML('beforeend', popupHTML);
		}
	}

	// Functions for popup logic
	window.openCoffeePopup = function (e) {
		if (e) e.preventDefault();
		document.getElementById('coffee-overlay').style.display = 'flex';
		document.body.style.overflow = 'hidden';
	};
	window.closeCoffeePopup = function () {
		document.getElementById('coffee-overlay').style.display = 'none';
		document.body.style.overflow = '';
		document.getElementById('copy-success').style.display = 'none';
	};
	window.copyCoffeeAddress = function () {
		const address = document.getElementById('coffee-address').textContent;
		navigator.clipboard.writeText(address).then(function () {
			const msg = document.getElementById('copy-success');
			msg.style.display = 'block';
			setTimeout(() => { msg.style.display = 'none'; }, 1500);
		});
	};

	// Wait for DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', injectPopup);
	} else {
		injectPopup();
	}
})();