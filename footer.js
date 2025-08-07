document.addEventListener('DOMContentLoaded', function () {
    const footer = document.getElementById('dynamic-footer');
    if (footer) {
        footer.innerHTML = `
            <p>
                Created by <a href="https://x.com/Golgoin" target="_blank">@Golgoin</a>
                 - 
                <a href="/cookies"><i class="fa-solid fa-cookie-bite fa-xs icon"></i><span> Cookie Policy</span></a>
            </p>
        `;
    }
});