class UIManager {
    constructor() {
        this.initialize();
    }

    initialize() {
        // Attach ripple effect to all buttons with class 'ripple-btn'
        document.querySelectorAll('.ripple-btn').forEach(button => {
            button.addEventListener('click', this.createRippleEffect);
        });
    }

    createRippleEffect(event) {
        const button = event.currentTarget;  // safer to use currentTarget

        // Validate button element and method existence
        if (!button || typeof button.getBoundingClientRect !== 'function') {
            console.error('Invalid button element for ripple effect:', button);
            return;
        }

        const rect = button.getBoundingClientRect();

        // Create ripple element
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;

        // Calculate position for ripple center
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        // Add 'ripple' class to trigger CSS animation
        ripple.classList.add('ripple');

        // Remove any existing ripples on this button
        const existingRipples = button.querySelectorAll('.ripple');
        existingRipples.forEach(r => r.remove());

        // Append ripple to button
        button.appendChild(ripple);

        // Cleanup ripple element after animation ends
        ripple.addEventListener('animationend', () => {
            ripple.remove();
        });
    }
}

// Initialize UI Manager after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    new UIManager();
});
