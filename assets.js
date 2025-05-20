const STATUS_SYMBOLS = {
    true: '✅',
    false: '❌',
    null: '⚪'
};

const MAINTENANCE_SYMBOLS = {
    true: '🚧',
    false: '🟢',
    null: '⚪'
};

async function fetchAssetData() {
    try {
        console.log('Starting API requests...');
        // Fetch combined asset settings and updates data from both endpoints in parallel
        const [settingsResponse, updatesResponse, newAssetsResponse] = await Promise.all([
            fetch('https://bitpanda.visionresources.info/settings'),
            fetch('https://bitpanda.visionresources.info/updates'),
            fetch('https://api.bitpanda.com/v1/prices/assets/new')
        ]);
        console.log('Settings endpoint response status:', settingsResponse.status);
        console.log('Updates endpoint response status:', updatesResponse.status);
        console.log('New assets endpoint response status:', newAssetsResponse.status);

        if (!settingsResponse.ok) {
            throw new Error(`API request failed: Settings (${settingsResponse.status})`);
        }
        if (!updatesResponse.ok) {
            throw new Error(`API request failed: Updates (${updatesResponse.status})`);
        }
        if (!newAssetsResponse.ok) {
            throw new Error(`API request failed: NewAssets (${newAssetsResponse.status})`);
        }

        const settings = await settingsResponse.json();
        const updates = await updatesResponse.json();
        const newAssets = await newAssetsResponse.json();

        // Process response
        console.log('Full settings response structure:', JSON.stringify(settings).slice(0, 200) + '...');
        console.log('Updates data:', updates);
        
        const combinedAssets = processAssetData(settings, newAssets);
        console.log('Combined assets:', combinedAssets);
        const container = document.getElementById('assetGroups');
        container.innerHTML = '';
        const updatesContainer = document.getElementById('updatesSection');
        
        renderUpdatesTable(updates, updatesContainer);
        renderAssetGroups(combinedAssets);

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('assetGroups').innerHTML = '<p class="error">Error loading data. Please try again later.</p>';
    }
}

function processAssetData(settings, newAssets) {
    // Add a boolean field "New" to each asset: true if its pid is in newAssets, else false
    let newPids = [];
    if (newAssets && Array.isArray(newAssets.data)) {
        newPids = newAssets.data.map(a => a.pid);
    }
    return settings.map(asset => ({
        ...asset,
        New: newPids.includes(asset.pid)
    }));
}

function groupAssets(assets) {
    const grouped = {};
    for (const asset of assets) {
        let typeName = (asset.asset_type_name || '').toLowerCase();
        // Normalize type names
        if (typeName === 'cryptocoin') {
            typeName = 'Crypto';
        } else {
            typeName = typeName.capitalize();
        }

        let groupName = (asset.asset_group_name || '').toLowerCase();
        // Normalize group names
        if (['coin', 'token'].includes(groupName)) {
            groupName = 'Coin/Token';
        } else if (groupName === 'fiat_earn') {
            groupName = 'Cash Plus';
        } else if (groupName === 'leveraged_token') {
            groupName = 'Leverage';
        } else if (groupName === 'security_token') {
            groupName = 'Security';
        } else if (groupName === 'metal') {
            groupName = 'Metal';
        } else if (groupName === 'stock') {
            groupName = 'Stock';
        } else if (groupName === 'etf') {
            groupName = 'ETF';
        } else if (groupName === 'etc') {
            groupName = 'ETC';
        } else if (groupName === 'index') {
            groupName = 'Index';
        } else {
            groupName = groupName.split('_').map(word => word.capitalize()).join(' ');
        }

        const groupKey = `${typeName}-${groupName}`;
        if (!grouped[groupKey]) {
            grouped[groupKey] = {
                typeName,
                groupName,
                assets: []
            };
        }
        grouped[groupKey].assets.push(asset);
    }
    return grouped;
}

function renderAssetGroups(assets) {
    const grouped = groupAssets(assets);
    const container = document.getElementById('assetGroups');

    Object.entries(grouped)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([_, group]) => {
            // Sort assets by name within each group
            group.assets.sort((a, b) => a.name.localeCompare(b.name));

            const details = document.createElement('details');
            const assetCount = group.assets.length;
            const badgeClass = assetCount > 10 ? 'badge-large' : 'badge-small';
            
            details.innerHTML = `
                <summary>
                    <span class="asset-count ${badgeClass}">${assetCount}</span>
                    <div class="summary-content">
                        <span class="group-type">${group.typeName}</span>
                        <span class="group-separator">-</span>
                        <span class="group-name">${group.groupName}</span>
                    </div>
                </summary>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Symbol</th>
                                <th>Buy</th>
                                <th>Sell</th>
                                <th>⬆️</th>
                                <th>⬇️</th>
                                <th>Limit Order</th>
                                <th>Stake</th>
                                <th>🚧</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.assets.map(asset => `
                                <tr>
                                    <td>${asset.name}${asset.New ? ' 🆕' : ''}</td>
                                    <td>${asset.symbol}</td>
                                    <td>${STATUS_SYMBOLS[asset.buy_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.sell_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.withdraw_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.deposit_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.limit_order]}</td>
                                    <td>${STATUS_SYMBOLS[asset.stakeable]}</td>
                                    <td>${MAINTENANCE_SYMBOLS[asset.maintenance]}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(details);
        });
}

function renderUpdatesTable(updates, container) {
    const updatesSection = document.createElement('details');
    updatesSection.className = 'updates-section';
    updatesSection.open = true;
    updatesSection.innerHTML = `
        <summary>
            <div class="summary-content">
                <span class="group-type">Recent Changes</span>
                <span class="group-separator">-</span>
                <span class="group-name">for assets and components</span>
            </div>
        </summary>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Assset/Component</th>
                        <th>New Status</th>
                        <th>Changed At</th>
                    </tr>
                </thead>
                <tbody>
                    ${updates.map(update => {
                        let statusClass = 'status-neutral';
                        if (update.new_status === 'operational') {
                            statusClass = 'status-positive';
                        } else if (['degraded_performance', 'partial_outage', 'major_outage'].includes(update.new_status)) {
                            statusClass = 'status-negative';
                        }
                        const date = new Date(update.changed_at);
                        const formattedDate = date.toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        // Only render description row if description is not null/empty
                        const hasDescription = update.description && update.description.trim() !== '';
                        return `
                            <tr class="toggle-description${hasDescription ? ' has-description' : ''}" style="cursor: pointer;">
                                <td>${update.component_name} ${hasDescription ? '<span class="desc-indicator" title="Show description">(i)</span>' : ''}</td>
                                <td class="${statusClass}">
                                    <span class="status-badge">${formatStatusText(update.new_status)}</span>
                                </td>
                                <td>${formattedDate}</td>
                            </tr>
                            ${hasDescription ? `<tr class="description-row" style="display: none">
                                <td colspan="3" style="text-align: left;">
                                    <strong></strong> ${update.description}
                                </td>
                            </tr>` : ''}
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    container.appendChild(updatesSection);

    // Add event listeners for toggle buttons
    const toggleRows = updatesSection.querySelectorAll('.toggle-description');
    toggleRows.forEach(row => {
        row.addEventListener('click', (event) => {
            const descriptionRow = row.nextElementSibling;
            if (descriptionRow && descriptionRow.classList.contains('description-row')) {
                const isVisible = descriptionRow.style.display === '';
                descriptionRow.style.display = isVisible ? 'none' : '';
                const arrow = row.querySelector('.arrow');
                if (arrow) {
                    arrow.textContent = isVisible ? '+' : '-';
                }
            }
        });
    });
}

function filterAssets() {
    const searchInput = document.getElementById('assetSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const maintenanceFilter = document.getElementById('maintenanceFilter').checked;
    const tradeOnlyFilter = document.getElementById('tradeOnlyFilter').checked;
    const fullyIntegratedFilter = document.getElementById('fullyIntegratedFilter').checked;
    const stakeableFilter = document.getElementById('stakeableFilter').checked;
    const newAssetsFilter = document.getElementById('newAssetsFilter')?.checked;
    // Specifically target details in the assetGroups container, excluding the updates section
    const details = document.getElementById('assetGroups').querySelectorAll('details');
    const noResults = document.getElementById('noResults');
    let totalVisible = 0;

    details.forEach(detail => {
        const tableBody = detail.querySelector('tbody');
        if (!tableBody) return;
        
        const rows = tableBody.querySelectorAll('tr');
        let visibleRows = 0;

        rows.forEach(row => {
            if (!row.querySelector('td')) return; // Skip header rows
            const cells = row.querySelectorAll('td');
            const name = cells[0].textContent.toLowerCase();
            const symbol = cells[1].textContent.toLowerCase();
            const maintenance = cells[8].textContent === '🚧';
            const withdraw = cells[4].textContent === '✅';
            const deposit = cells[5].textContent === '✅';
            const stakeable = cells[7].textContent === '✅';
            const isNew = cells[0].innerHTML.includes('🆕');

            const matchesSearch = name.includes(searchTerm) || symbol.includes(searchTerm);
            const matchesMaintenance = !maintenanceFilter || maintenance;
            const matchesTradeOnly = !tradeOnlyFilter || (!withdraw && !deposit);
            const matchesFullyIntegrated = !fullyIntegratedFilter || (withdraw || deposit);
            const matchesStakeable = !stakeableFilter || stakeable;
            const matchesNewAssets = !newAssetsFilter || isNew;

            const isVisible = matchesSearch && matchesMaintenance && matchesTradeOnly && matchesFullyIntegrated && matchesStakeable && matchesNewAssets;
            row.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleRows++;
        });

        const summary = detail.querySelector('summary');
        const originalText = summary.getAttribute('data-original-text') || summary.textContent;
        if (!summary.getAttribute('data-original-text')) {
            summary.setAttribute('data-original-text', originalText);
        }

        if (visibleRows > 0) {
            detail.style.display = '';
                const summary = detail.querySelector('summary');
                const assetCountElement = summary.querySelector('.asset-count');
                if (assetCountElement) {
                    assetCountElement.textContent = visibleRows;
                    assetCountElement.className = 'asset-count ' + (visibleRows > 10 ? 'badge-large' : 'badge-small');
                }
                totalVisible += visibleRows;
        } else {
            detail.style.display = 'none';
        }
    });

    noResults.style.display = totalVisible === 0 ? 'block' : 'none';

    // --- Filter updates table by search box ---
    const updatesSection = document.querySelector('.updates-section');
    if (updatesSection) {
        const updatesTable = updatesSection.querySelector('table');
        if (updatesTable) {
            const updateRows = updatesTable.querySelectorAll('tbody tr');
            let updatesVisible = 0;
            // Remove any previous 'no results' row
            const tbody = updatesTable.querySelector('tbody');
            const prevNoResults = tbody.querySelector('.no-updates-results');
            if (prevNoResults) tbody.removeChild(prevNoResults);
            // Updated logic: iterate through all rows, pairing main and description rows only if present
            for (let i = 0; i < updateRows.length; ) {
                const row = updateRows[i];
                if (!row) break;
                if (!row.classList.contains('toggle-description')) {
                    i++;
                    continue;
                }
                const nameCell = row.querySelector('td');
                let descRow = null;
                if (updateRows[i + 1] && updateRows[i + 1].classList.contains('description-row')) {
                    descRow = updateRows[i + 1];
                }
                const descText = descRow && descRow.textContent ? descRow.textContent.toLowerCase() : '';
                const name = nameCell ? nameCell.textContent.toLowerCase() : '';
                // Match search in either the main row (component name) or the description row
                const matchesSearch = name.includes(searchTerm) || descText.includes(searchTerm);
                row.style.display = matchesSearch ? '' : 'none';
                if (matchesSearch) updatesVisible++;
                i += descRow ? 2 : 1;
            }
            // If no updates are visible, show a 'no results' row
            if (updatesVisible === 0) {
                const noRow = document.createElement('tr');
                noRow.className = 'no-updates-results';
                const td = document.createElement('td');
                td.colSpan = 3;
                td.style.textAlign = 'center';
                td.textContent = 'No updates match your search.';
                noRow.appendChild(td);
                tbody.appendChild(noRow);
            }
        }
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    const button = document.getElementById('theme-toggle');
    const themeIcon = button.querySelector('.theme-icon');
    themeIcon.innerHTML = newTheme === 'dark' ? '☀' : '🌑';
}

// Add String.prototype.capitalize() if not exists
if (!String.prototype.capitalize) {
    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    };
}

function formatStatusText(status) {
    return status.replace(/_/g, ' ').capitalize();
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
    const button = document.getElementById('theme-toggle');
    const themeIcon = button.querySelector('.theme-icon');
    themeIcon.innerHTML = theme === 'dark' ? '☀' : '🌑';

    // Set up event listeners
    const searchInput = document.getElementById('assetSearch');
    const maintenanceFilter = document.getElementById('maintenanceFilter');
    const tradeOnlyFilter = document.getElementById('tradeOnlyFilter');
    const fullyIntegratedFilter = document.getElementById('fullyIntegratedFilter');
    const stakeableFilter = document.getElementById('stakeableFilter');
    const newAssetsFilter = document.getElementById('newAssetsFilter');

    searchInput.addEventListener('input', filterAssets);
    maintenanceFilter.addEventListener('change', filterAssets);
    tradeOnlyFilter.addEventListener('change', filterAssets);
    fullyIntegratedFilter.addEventListener('change', filterAssets);
    stakeableFilter.addEventListener('change', filterAssets);
    newAssetsFilter.addEventListener('change', filterAssets);

    // Fetch initial data
    fetchAssetData();
});
