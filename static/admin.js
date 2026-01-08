/* AIResQ ClimSols - Admin Page JavaScript (Hindi) */

let authHeader = '';
let allSubmissions = [];
let allVolunteers = [];
let currentTab = 'submissions';
let currentFilter = 'all';
let currentSearchQuery = '';
let currentUrls = [];
let currentExtractedNews = [];
let currentSubmissionId = null;

// Check for existing valid session on page load
async function checkExistingSession() {
    try {
        const response = await fetch('/api/admin/submissions', {
            credentials: 'same-origin'
        });

        if (response.ok) {
            document.getElementById('authCard').style.display = 'none';
            document.getElementById('adminControls').classList.add('active');
            const data = await response.json();
            allSubmissions = data.items;
            updateStats(data.items);
            displaySubmissions(data.items);
        }
    } catch (e) {
        // No valid session, show login form
    }
}

// Tab switching
function switchTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.closest('.tab-btn').classList.add('active');
    }

    document.getElementById('submissionsTab').classList.add('hidden');
    document.getElementById('volunteersTab').classList.add('hidden');
    document.getElementById('socialTab').classList.add('hidden');
    document.getElementById('aiTab').classList.add('hidden');

    if (tabName === 'submissions') {
        document.getElementById('submissionsTab').classList.remove('hidden');
    } else if (tabName === 'volunteers') {
        document.getElementById('volunteersTab').classList.remove('hidden');
        if (allVolunteers.length === 0) refreshVolunteers();
    } else if (tabName === 'social') {
        document.getElementById('socialTab').classList.remove('hidden');
    } else if (tabName === 'ai') {
        document.getElementById('aiTab').classList.remove('hidden');
    }
}

// Login
async function adminConnect() {
    const username = document.getElementById('admin_user').value.trim();
    const password = document.getElementById('admin_pass').value;
    const authStatus = document.getElementById('authStatus');

    if (!username || !password) {
        authStatus.textContent = 'Please enter both username and password';
        authStatus.className = 'auth-status error';
        authStatus.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'same-origin'
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            authStatus.textContent = '✓ Login successful';
            authStatus.className = 'auth-status success';
            authStatus.style.display = 'block';

            setTimeout(() => {
                document.getElementById('authCard').style.display = 'none';
                document.getElementById('adminControls').classList.add('active');
                refreshSubmissions();
            }, 1000);
        } else {
            throw new Error(data.error || 'Authentication failed');
        }
    } catch (error) {
        authStatus.textContent = '✗ ' + error.message;
        authStatus.className = 'auth-status error';
        authStatus.style.display = 'block';
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
    } catch (e) { }

    allSubmissions = [];
    document.getElementById('adminControls').classList.remove('active');
    document.getElementById('authCard').style.display = 'block';
    document.getElementById('admin_user').value = '';
    document.getElementById('admin_pass').value = '';
    document.getElementById('authStatus').style.display = 'none';
}

// Set filter and refresh
function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    refreshSubmissions();
}

// Refresh submissions with filter support
async function refreshSubmissions() {
    const list = document.getElementById('submissionsList');
    list.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><p style="color: var(--text-secondary);">Loading...</p></div>';

    try {
        const url = `/api/admin/submissions${currentFilter !== 'all' ? '?filter=' + currentFilter : ''}`;
        const response = await fetch(url, {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                throw new Error('Session expired, please login again');
            }
            throw new Error('Failed to fetch submissions');
        }

        const data = await response.json();
        allSubmissions = data.items;

        if (currentFilter === 'all') {
            updateStats(data.items);
        }

        displaySubmissions(data.items);

    } catch (error) {
        list.innerHTML = `<div class="card" style="padding: 3rem; text-align: center;"><p style="color: var(--error);">Error: ${error.message}</p></div>`;
    }
}

// Update statistics
function updateStats(items) {
    const total = items.length;
    const critical = items.filter(i => i.flood_depth_cm > 100).length;
    const pending = items.filter(i => !i.verification_status || i.verification_status === 'pending').length;
    const verified = items.filter(i => i.verification_status === 'valid').length;

    document.getElementById('totalReports').textContent = total;
    document.getElementById('criticalAreas').textContent = critical;
    document.getElementById('pendingReports').textContent = pending;
    document.getElementById('verifiedReports').textContent = verified;
}

// Display submissions with thumbnails and delete button
function displaySubmissions(items) {
    const list = document.getElementById('submissionsList');

    if (items.length === 0) {
        list.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><p style="color: var(--text-secondary);">No submissions found</p></div>';
        return;
    }

    list.innerHTML = items.map(item => {
        const status = item.verification_status || 'pending';
        const statusClass = status === 'valid' ? 'valid' : status === 'invalid' ? 'invalid' : 'pending';
        const thumbSrc = item.thumbnail_path ? '/' + item.thumbnail_path : (item.image_path ? '/' + item.image_path : '');
        const imgHtml = thumbSrc ?
            `<img src="${thumbSrc}" alt="Flood photo" class="submission-thumb" onerror="this.style.display='none'">` :
            `<div class="submission-thumb" style="display: flex; align-items: center; justify-content: center; background: var(--bg-light);"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;
        return `
        <div class="submission-card">
            ${imgHtml}
            <div class="submission-info" style="flex: 1;">
                <h4>${item.name || 'Anonymous'} ${item.phone ? '- ' + item.phone : ''}</h4>
                <p><strong>Location:</strong> ${[item.street, item.zone, item.ward].filter(Boolean).join(', ') || 'Not specified'}</p>
                <p><strong>Reference:</strong> ${item.vehicle_type || 'N/A'} | <strong>Depth:</strong> ${item.flood_depth_cm} cm</p>
                <p><strong>GPS:</strong> ${item.gps?.lat?.toFixed(5) || 'N/A'}, ${item.gps?.lon?.toFixed(5) || 'N/A'}</p>
                <p><strong>Submitted:</strong> ${new Date(item.received_at).toLocaleString()}</p>
                <p><span class="status-badge ${statusClass}">${status}</span></p>
            </div>
            <div class="submission-actions">
                <button class="view-btn" onclick="openModal('${item.id}')">View</button>
                <button class="delete-btn" onclick="deleteSubmission('${item.id}')">Delete</button>
            </div>
        </div>
    `}).join('');
}

// Delete submission with confirmation
async function deleteSubmission(id) {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/submission/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Delete failed');
        }

        refreshSubmissions();
    } catch (error) {
        alert('Error deleting submission: ' + error.message);
    }
}

// Filter submissions
function filterSubmissions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filtered = allSubmissions.filter(item => {
        return item.name.toLowerCase().includes(searchTerm) ||
            item.phone.includes(searchTerm) ||
            item.id.toLowerCase().includes(searchTerm) ||
            (item.street && item.street.toLowerCase().includes(searchTerm)) ||
            (item.zone && item.zone.toLowerCase().includes(searchTerm)) ||
            (item.ward && item.ward.toLowerCase().includes(searchTerm));
    });

    displaySubmissions(filtered);
}

// Volunteer functions
async function refreshVolunteers() {
    const list = document.getElementById('volunteersList');
    list.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><p style="color: var(--text-secondary);">Loading volunteers...</p></div>';

    try {
        const response = await fetch('/api/admin/volunteers', {
            credentials: 'same-origin'
        });

        if (!response.ok) throw new Error('Failed to fetch volunteers');

        const data = await response.json();
        allVolunteers = data.items;
        displayVolunteers(data.items);

    } catch (error) {
        list.innerHTML = `<div class="card" style="padding: 3rem; text-align: center;"><p style="color: var(--error);">Error: ${error.message}</p></div>`;
    }
}

function displayVolunteers(items) {
    const list = document.getElementById('volunteersList');

    if (items.length === 0) {
        list.innerHTML = '<div class="card" style="padding: 3rem; text-align: center;"><p style="color: var(--text-secondary);">No volunteers registered yet</p></div>';
        return;
    }

    list.innerHTML = items.map(item => {
        const statusClass = item.status === 'active' ? 'valid' : 'pending';
        const skills = item.skills && item.skills.length > 0 ? item.skills.join(', ') : 'None specified';
        return `
        <div class="submission-card">
            <div style="display: flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: var(--primary-teal-dim); border-radius: 50%; flex-shrink: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-teal)" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                </svg>
            </div>
            <div class="submission-info" style="flex: 1;">
                <h4>${item.username}</h4>
                <p><strong>Phone:</strong> ${item.phone}</p>
                <p><strong>Skills:</strong> ${skills}</p>
                <p><strong>Availability:</strong> ${item.availability || 'Not specified'}</p>
                <p><strong>Registered:</strong> ${item.registered_at ? new Date(item.registered_at).toLocaleString() : 'N/A'}</p>
                <p><span class="status-badge ${statusClass}">${item.status || 'active'}</span></p>
            </div>
        </div>
    `}).join('');
}

function filterVolunteers() {
    const searchTerm = document.getElementById('volunteerSearchInput').value.toLowerCase();

    const filtered = allVolunteers.filter(item => {
        return item.username.toLowerCase().includes(searchTerm) ||
            item.phone.includes(searchTerm) ||
            (item.skills && item.skills.some(s => s.toLowerCase().includes(searchTerm)));
    });

    displayVolunteers(filtered);
}

// Export CSV
async function exportCSV() {
    try {
        const response = await fetch('/api/admin/export.csv', {
            headers: { 'Authorization': authHeader }
        });

        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submissions_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Export failed: ' + error.message);
    }
}

// Configure scraper
function configureScraper() {
    alert('Web/Social Media scraper configuration coming soon. Use your own endpoint to fetch scraped data.');
}

// Step 1: Search for URLs
async function performAISearch() {
    const query = document.getElementById('aiSearchQuery').value.trim();
    const maxUrls = parseInt(document.getElementById('aiMaxUrls').value);
    const searchBtn = document.getElementById('aiSearchBtn');
    const urlResults = document.getElementById('aiUrlResults');

    if (!query) {
        showAIStatus('Please enter a search query', 'error');
        return;
    }

    currentSearchQuery = query;
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="spinner"></span> Searching...';
    urlResults.style.display = 'none';
    document.getElementById('aiExtractionResults').style.display = 'none';

    try {
        showAIStatus('Searching for relevant news URLs...', 'info');

        const response = await fetch('/api/admin/ai/search', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, max_urls: maxUrls })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Search failed');
        }

        currentUrls = data.urls || data.results || [];

        if (currentUrls.length === 0) {
            showAIStatus('No URLs found for this query. Try a different search term.', 'warning');
        } else {
            showAIStatus(`Found ${currentUrls.length} URL(s). Select the ones to extract and click "Extract Intelligence".`, 'success');
            displayFoundUrls(currentUrls);
        }
    } catch (error) {
        showAIStatus(error.message, 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg> Search`;
    }
}

// Display found URLs with checkboxes
function displayFoundUrls(urls) {
    const urlList = document.getElementById('aiUrlList');
    const urlResults = document.getElementById('aiUrlResults');

    urlList.innerHTML = urls.map((url, idx) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; ${idx < urls.length - 1 ? 'border-bottom: 1px solid var(--border-color);' : ''}">
            <input type="checkbox" id="url_${idx}" checked style="width: 18px; height: 18px; accent-color: var(--primary-teal); cursor: pointer;">
            <label for="url_${idx}" style="flex: 1; font-size: 0.9rem; word-break: break-all; color: var(--text-secondary); cursor: pointer;">
                <a href="${url}" target="_blank" style="color: var(--primary-teal);" onclick="event.stopPropagation();">${url}</a>
            </label>
        </div>
    `).join('');

    urlResults.style.display = 'block';
}

// Step 2: Extract intelligence from selected URLs
async function extractFromUrls() {
    const extractBtn = document.getElementById('aiExtractBtn');
    const checkboxes = document.querySelectorAll('#aiUrlList input[type="checkbox"]');

    const selectedUrls = [];
    checkboxes.forEach((cb, idx) => {
        if (cb.checked && currentUrls[idx]) {
            selectedUrls.push(currentUrls[idx]);
        }
    });

    if (selectedUrls.length === 0) {
        showAIStatus('Please select at least one URL to extract', 'error');
        return;
    }

    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="spinner"></span> Extracting...';
    showAIStatus(`Extracting intelligence from ${selectedUrls.length} URL(s)... This may take a moment.`, 'info');

    try {
        const response = await fetch('/api/admin/ai/extract', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urls: selectedUrls })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Extraction failed');
        }

        currentExtractedNews = processExtractedData(data);

        if (currentExtractedNews.length === 0) {
            showAIStatus('No news items could be extracted. Try different URLs.', 'warning');
        } else {
            showAIStatus(`✓ Extracted ${currentExtractedNews.length} bullet point(s). Review and Save or Discard.`, 'success');
            displayExtractedNews(currentExtractedNews);
        }
    } catch (error) {
        showAIStatus(error.message, 'error');
    } finally {
        extractBtn.disabled = false;
        extractBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path></svg> Extract Intelligence`;
    }
}

// Process extracted data into news items
function processExtractedData(data) {
    let items = [];
    const sourceUrls = data.urls || currentUrls || [];
    const sourceUrl = sourceUrls.length > 0 ? sourceUrls.join(', ') : 'Extracted content';

    console.log('Processing extracted data:', data);

    if (data.summary) {
        const summaryText = data.summary;
        const lines = summaryText.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);

        let currentSection = '';

        lines.forEach(line => {
            if (line.match(/^\*\*[^*]+\*\*\s*$/)) {
                currentSection = line.replace(/\*\*/g, '').trim();
                return;
            }

            let cleanLine = line
                .replace(/^\*\*/, '')
                .replace(/\*\*$/, '')
                .replace(/\*\*/g, '')
                .replace(/^[-•*]\s*/, '')
                .replace(/^\d+\.\s*/, '')
                .trim();

            if (cleanLine.length < 10) return;

            const subItems = cleanLine.split(/\s{2,}|\s*\|\s*/).filter(s => s.trim().length > 10);

            if (subItems.length > 1) {
                subItems.forEach(subItem => {
                    items.push({
                        text: subItem.trim(),
                        source: sourceUrl,
                        section: currentSection
                    });
                });
            } else if (cleanLine.length > 10) {
                items.push({
                    text: cleanLine,
                    source: sourceUrl,
                    section: currentSection
                });
            }
        });
    }

    if (data.extracted && Array.isArray(data.extracted)) {
        data.extracted.forEach(page => {
            const pageUrl = page.url || sourceUrl;
            if (page.content) {
                const lines = page.content.split('\n').filter(line => line.trim());
                lines.forEach(line => {
                    const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
                    if (cleanLine.length > 10) {
                        items.push({ text: cleanLine, source: pageUrl });
                    }
                });
            }
            if (page.summary) {
                items.push({ text: page.summary.trim(), source: pageUrl });
            }
            if (page.key_points && Array.isArray(page.key_points)) {
                page.key_points.forEach(point => {
                    if (point && point.length > 10) {
                        items.push({ text: point, source: pageUrl });
                    }
                });
            }
        });
    }

    if (data.results && Array.isArray(data.results)) {
        data.results.forEach(result => {
            if (result.text || result.content || result.summary) {
                const text = (result.text || result.content || result.summary).trim();
                if (text.length > 10) {
                    items.push({ text: text, source: result.url || result.source || sourceUrl });
                }
            }
        });
    }

    if (data.content && typeof data.content === 'string') {
        const lines = data.content.split('\n').filter(line => line.trim());
        lines.forEach(line => {
            const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
            if (cleanLine.length > 10) {
                items.push({ text: cleanLine, source: sourceUrl });
            }
        });
    }

    items = items.filter(item => item.text && item.text.length > 10);
    const uniqueItems = [];
    const seen = new Set();
    items.forEach(item => {
        const normalizedText = item.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (!seen.has(normalizedText) && normalizedText.length > 10) {
            seen.add(normalizedText);
            uniqueItems.push(item);
        }
    });

    console.log('Processed items:', uniqueItems);
    return uniqueItems;
}

// Display extracted news in bullet points
function displayExtractedNews(items) {
    const container = document.getElementById('aiExtractionResults');
    const newsList = document.getElementById('aiNewsList');
    const countEl = document.getElementById('aiExtractionCount');

    countEl.textContent = `${items.length} item(s)`;

    newsList.innerHTML = `
        <ul style="list-style: none; padding: 0; margin: 0;">
            ${items.map((item, idx) => `
                <li style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: ${idx % 2 === 0 ? 'var(--bg-light)' : 'white'}; border-radius: 8px; margin-bottom: 8px;">
                    <span style="flex-shrink: 0; width: 24px; height: 24px; background: var(--primary-teal); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">${idx + 1}</span>
                    <div style="flex: 1;">
                        <p style="margin: 0 0 4px 0; color: var(--text-primary); line-height: 1.5;">${escapeHtml(item.text)}</p>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">
                            <a href="${item.source}" target="_blank" style="color: var(--primary-teal);">Source</a>
                        </p>
                    </div>
                </li>
            `).join('')}
        </ul>
    `;

    container.style.display = 'block';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Discard extracted news
function discardExtractedNews() {
    if (confirm('Are you sure you want to discard the extracted news? This cannot be undone.')) {
        currentExtractedNews = [];
        document.getElementById('aiExtractionResults').style.display = 'none';
        showAIStatus('Extracted news discarded', 'info');
    }
}

// Confirm save news
function confirmSaveNews() {
    if (currentExtractedNews.length === 0) {
        alert('No news items to save');
        return;
    }

    if (confirm(`Save ${currentExtractedNews.length} news item(s) to records?\n\nQuery: "${currentSearchQuery}"`)) {
        saveNewsToRecords();
    }
}

// Save news to records
async function saveNewsToRecords() {
    showAIStatus('Saving news to records...', 'info');

    try {
        const response = await fetch('/api/admin/ai/news/save', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: currentSearchQuery,
                source_urls: currentUrls,
                news_items: currentExtractedNews
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Save failed');
        }

        showAIStatus(`Successfully saved ${data.saved_count} news item(s)!`, 'success');
        currentExtractedNews = [];
        document.getElementById('aiExtractionResults').style.display = 'none';
        refreshSavedNews();
    } catch (error) {
        showAIStatus('Failed to save: ' + error.message, 'error');
    }
}

// Refresh saved news list
async function refreshSavedNews() {
    const container = document.getElementById('savedNewsList');
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 24px;">Loading saved records...</p>';

    try {
        const response = await fetch('/api/admin/ai/news', {
            headers: { 'Authorization': authHeader }
        });

        if (!response.ok) throw new Error('Failed to fetch saved news');

        const data = await response.json();
        displaySavedNews(data.items);
    } catch (error) {
        container.innerHTML = `<p style="color: var(--error); text-align: center; padding: 24px;">Error: ${error.message}</p>`;
    }
}

// Display saved news records
function displaySavedNews(items) {
    const container = document.getElementById('savedNewsList');

    if (items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 24px;">No saved news records yet. Search and extract news to get started.</p>';
        return;
    }

    container.innerHTML = items.map(record => `
        <div class="card" style="padding: 16px; margin-bottom: 12px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h4 style="margin: 0 0 4px 0; color: var(--text-primary);">"${escapeHtml(record.query)}"</h4>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
                        ${new Date(record.scraped_at).toLocaleString()} • ${record.item_count} item(s)
                    </p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="newsBtn_${record.id}" class="btn-outline" onclick="toggleNewsExpand('${record.id}')" style="padding: 6px 12px; font-size: 0.85rem;">
                        View Details
                    </button>
                    <button class="btn-outline" onclick="deleteSavedNews('${record.id}')" style="padding: 6px 12px; font-size: 0.85rem; color: var(--error); border-color: var(--error);">
                        Delete
                    </button>
                </div>
            </div>
            <div id="newsExpand_${record.id}" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <ul style="list-style: disc; padding-left: 20px; margin: 0;">
                    ${record.news_items.slice(0, 10).map(item => `
                        <li style="margin-bottom: 8px; color: var(--text-primary); line-height: 1.5;">${escapeHtml(item.text || item)}</li>
                    `).join('')}
                    ${record.news_items.length > 10 ? `<li style="color: var(--text-secondary);">... and ${record.news_items.length - 10} more items</li>` : ''}
                </ul>
            </div>
        </div>
    `).join('');
}

// Toggle news expand/collapse
function toggleNewsExpand(recordId) {
    const expandEl = document.getElementById(`newsExpand_${recordId}`);
    const btnEl = document.getElementById(`newsBtn_${recordId}`);
    if (expandEl.style.display === 'none') {
        expandEl.style.display = 'block';
        if (btnEl) btnEl.textContent = 'Hide Details';
    } else {
        expandEl.style.display = 'none';
        if (btnEl) btnEl.textContent = 'View Details';
    }
}

// Delete saved news
async function deleteSavedNews(newsId) {
    if (!confirm('Are you sure you want to delete this saved news record?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/ai/news/${newsId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader }
        });

        if (!response.ok) throw new Error('Delete failed');

        refreshSavedNews();
    } catch (error) {
        alert('Failed to delete: ' + error.message);
    }
}

// Show AI status message
function showAIStatus(message, type) {
    const statusEl = document.getElementById('aiSearchStatus');
    statusEl.style.display = 'block';

    const colors = {
        'success': { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)', border: 'var(--success)' },
        'error': { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--error)', border: 'var(--error)' },
        'warning': { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)', border: 'var(--warning)' },
        'info': { bg: 'rgba(13, 148, 136, 0.1)', text: 'var(--primary-teal)', border: 'var(--primary-teal)' }
    };

    const style = colors[type] || colors['info'];
    statusEl.style.background = style.bg;
    statusEl.style.color = style.text;
    statusEl.style.border = `1px solid ${style.border}`;
    statusEl.textContent = message;
}

// Modal functions
function openModal(submissionId) {
    currentSubmissionId = submissionId;
    const item = allSubmissions.find(s => s.id === submissionId);
    if (!item) return;

    document.getElementById('modalImage').src = '/' + item.image_path;
    document.getElementById('modalName').textContent = item.name;
    document.getElementById('modalPhone').textContent = item.phone;
    document.getElementById('modalLocation').textContent = [item.street, item.zone, item.ward].filter(Boolean).join(', ') || 'Not specified';
    document.getElementById('modalVehicle').textContent = item.vehicle_type || 'N/A';
    document.getElementById('modalDepth').textContent = item.flood_depth_cm;
    document.getElementById('modalGPS').textContent = item.gps?.lat ? `${item.gps.lat}, ${item.gps.lon} (±${item.gps.accuracy || '?'}m)` : 'N/A';
    document.getElementById('modalRemarks').textContent = item.remarks || 'None';
    document.getElementById('modalTime').textContent = new Date(item.received_at).toLocaleString();

    const status = item.verification_status || 'pending';
    const statusEl = document.getElementById('modalStatus');
    statusEl.innerHTML = `<span class="status-badge ${status}">${status}</span>`;

    document.getElementById('submissionModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('submissionModal').classList.add('hidden');
    currentSubmissionId = null;
}

async function verifySubmission(status) {
    if (!currentSubmissionId) return;

    try {
        const response = await fetch(`/api/admin/verify/${currentSubmissionId}`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: status })
        });

        if (!response.ok) throw new Error('Verification failed');

        const data = await response.json();
        if (data.ok) {
            const item = allSubmissions.find(s => s.id === currentSubmissionId);
            if (item) item.verification_status = status;

            displaySubmissions(allSubmissions);
            updateStats(allSubmissions);
            closeModal();
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ==================== LANGUAGE SWITCHING ====================
const LANGUAGES = {
    'en': { name: 'English', suffix: '' },
    'hn': { name: 'हिंदी', suffix: '_hn' },
    'bn': { name: 'বাংলা', suffix: '_bn' },
    'ta': { name: 'தமிழ்', suffix: '_ta' },
    'te': { name: 'తెలుగు', suffix: '_te' },
    'mr': { name: 'मराठी', suffix: '_mr' },
    'gu': { name: 'ગુજરાતી', suffix: '_gu' },
    'kn': { name: 'ಕನ್ನಡ', suffix: '_kn' },
    'ml': { name: 'മലയാളം', suffix: '_ml' },
    'pa': { name: 'ਪੰਜਾਬੀ', suffix: '_pa' },
    'or': { name: 'ଓଡ଼ିଆ', suffix: '_or' },
    'as': { name: 'অসমীয়া', suffix: '_as' },
    'ur': { name: 'اردو', suffix: '_ur' }
};

function getPageBase() {
    let path = window.location.pathname;
    let filename = path.split('/').pop() || 'admin';
    filename = filename.replace(/\.html$/, '');
    filename = filename.replace(/(_hn|_bn|_ta|_te|_mr|_gu|_kn|_ml|_pa|_or|_as|_ur)$/, '');
    return filename || 'admin';
}

function getCurrentLang() {
    const path = window.location.pathname;
    const match = path.match(/(_hn|_bn|_ta|_te|_mr|_gu|_kn|_ml|_pa|_or|_as|_ur)(?:\.html)?$/);
    if (match) return match[1].substring(1);
    return 'en';
}

function switchLanguage(langCode) {
    localStorage.setItem('preferredLang', langCode);
    const base = getPageBase();
    const suffix = LANGUAGES[langCode]?.suffix || '';
    const newPage = '/' + base + suffix;

    fetch(newPage, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                window.location.href = newPage;
            } else {
                console.warn(`Page ${newPage} not found, staying on current page`);
                localStorage.setItem('preferredLang', 'en');
                if (getCurrentLang() !== 'en') {
                    window.location.href = '/' + base;
                }
            }
        })
        .catch(() => {
            window.location.href = newPage;
        });
}

function toggleLangMenu(event) {
    event.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('open');
}

function toggleIndicSubmenu(event) {
    event.stopPropagation();
    document.getElementById('indicSubmenu').classList.toggle('open');
}

function highlightCurrentLang() {
    const currentLang = getCurrentLang();
    document.querySelectorAll('.lang-menu-item[data-lang]').forEach(item => {
        item.classList.toggle('active', item.dataset.lang === currentLang);
    });
}

function initLanguagePreference() {
    const savedLang = localStorage.getItem('preferredLang');
    const currentLang = getCurrentLang();

    if (savedLang && savedLang !== currentLang && LANGUAGES[savedLang]) {
        const base = getPageBase();
        const suffix = LANGUAGES[savedLang].suffix;
        const newPage = '/' + base + suffix;

        fetch(newPage, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    window.location.href = newPage;
                }
            })
            .catch(() => { });
    }

    highlightCurrentLang();
}

// Event Listeners
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    checkExistingSession();
    initLanguagePreference();
    
    // Modal event listeners
    const modal = document.getElementById('submissionModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) closeModal();
        });
    }
    
    // Enter key to trigger search
    const aiSearchInput = document.getElementById('aiSearchQuery');
    if (aiSearchInput) {
        aiSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performAISearch();
        });
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
