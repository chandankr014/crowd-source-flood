/* =============================================================================
   AIResQ ClimSols - Core JavaScript
   ============================================================================= */

// =============================================================================
// LANGUAGE SUPPORT
// =============================================================================

function toggleLangMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.querySelector('.lang-menu');
    const dropdown = document.querySelector('.lang-dropdown');
    
    // Close submenu if open
    const indicSubmenu = document.getElementById('indicSubmenu');
    if (indicSubmenu) {
        indicSubmenu.classList.remove('open');
    }
    
    // Toggle main menu
    if (menu) {
        menu.classList.toggle('show');
    }
}

function toggleIndicSubmenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = document.getElementById('indicSubmenu');
    if (wrapper) {
        wrapper.classList.toggle('open');
    }
}

function switchLanguage(lang) {
    // Get current page from body or path
    const currentPath = window.location.pathname;
    let targetPage = '';
    
    // Determine current page
    if (currentPath.includes('/report')) {
        targetPage = 'report';
    } else if (currentPath.includes('/volunteer')) {
        targetPage = 'volunteer';
    } else if (currentPath.includes('/about')) {
        targetPage = 'about';
    } else if (currentPath.includes('/map')) {
        targetPage = 'map';
    } else if (currentPath.includes('/admin')) {
        targetPage = 'admin.html';
    }
    
    if (lang === 'en') {
        window.location.href = targetPage ? `/${targetPage}` : '/';
    } else {
        window.location.href = targetPage ? `/${lang}/${targetPage}` : `/${lang}/`;
    }
}

// Close menus when clicking outside
document.addEventListener('click', (event) => {
    const langDropdown = document.querySelector('.lang-dropdown');
    const langMenu = document.querySelector('.lang-menu');
    const indicSubmenu = document.getElementById('indicSubmenu');
    
    // Check if click is outside the language dropdown
    if (langDropdown && !langDropdown.contains(event.target)) {
        if (langMenu) {
            langMenu.classList.remove('show');
        }
        if (indicSubmenu) {
            indicSubmenu.classList.remove('open');
        }
    }
});

// =============================================================================
// MOBILE NAVIGATION
// =============================================================================

function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) {
        mobileNav.classList.toggle('hidden');
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function showStatus(elementId, message, isSuccess) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.textContent = message;
    el.className = `status-msg ${isSuccess ? 'success' : 'error'}`;
    el.classList.remove('hidden');
    
    if (isSuccess) {
        setTimeout(() => {
            el.classList.add('hidden');
        }, 5000);
    }
}

function formatDateTime(date) {
    const d = new Date(date);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =============================================================================
// FORM CHECKBOX/RADIO HANDLING
// =============================================================================

function toggleCheckbox(label, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const checkbox = label.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    label.classList.toggle('selected', checkbox.checked);
}

function selectRadio(label, groupName, event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Deselect all in group
    const group = label.closest('.radio-group');
    group.querySelectorAll('.radio-item').forEach(item => {
        item.classList.remove('selected');
        item.querySelector('input').checked = false;
    });
    
    // Select clicked item
    const radio = label.querySelector('input[type="radio"]');
    radio.checked = true;
    label.classList.add('selected');
}

// =============================================================================
// PAGE INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('AIResQ ClimSols initialized');
});
