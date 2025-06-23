const STATUS_SYMBOLS = {
    true: '✅',
    false: '❌',
    null: '❌'
};

const MAINTENANCE_SYMBOLS = {
    true: '🚧',
    false: '🟢',
    null: '❌'
};

const API_ENDPOINT_SETTINGS = 'https://webhook.visionresources.info/settings';
const API_ENDPOINT_UPDATES = 'https://webhook.visionresources.info/updates';
const API_ENDPOINT_NEW_ASSETS = 'https://api.bitpanda.com/v1/prices/assets/new';

async function fetchAssetData() {
    try {
        console.log('Starting API requests...');
        // Fetch combined asset settings and updates data from both endpoints in parallel
        const [settingsResponse, updatesResponse, newAssetsResponse] = await Promise.all([
            fetch(API_ENDPOINT_SETTINGS),
            fetch(API_ENDPOINT_UPDATES),
            fetch(API_ENDPOINT_NEW_ASSETS)
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
    let newPidsSet = new Set();
    if (newAssets && Array.isArray(newAssets.data)) {
        newPidsSet = new Set(newAssets.data.map(a => a.pid));
    }
    return settings.map(asset => ({
        ...asset,
        New: newPidsSet.has(asset.pid)
    }));
}

function groupAssets(assets) {
    const grouped = {};
    const groupNameMap = {
        'coin': 'Coin/Token',
        'token': 'Coin/Token',
        'fiat_earn': 'Cash Plus',
        'leveraged_token': 'Leverage',
        'security_token': 'Security',
        'metal': 'Metal',
        'stock': 'Stock',
        'etf': 'ETF',
        'etc': 'ETC',
        'index': 'Index'
        // Add other specific mappings here if needed
    };

    for (const asset of assets) {
        let typeName = (asset.asset_type_name || '').toLowerCase();
        // Normalize type names
        if (typeName === 'cryptocoin') {
            typeName = 'Crypto';
        } else {
            typeName = typeName.capitalize();
        }

        let rawGroupName = (asset.asset_group_name || '').toLowerCase();
        let groupName = groupNameMap[rawGroupName];

        if (!groupName) {
            // Default normalization for unmapped group names
            groupName = rawGroupName.split('_').map(word => word.capitalize()).join(' ');
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
            
            // Determine if the current group is Crypto
            const isCryptoGroup = group.typeName === 'Crypto' && group.groupName === 'Coin/Token';

            let cryptoHeaders = '';
            if (isCryptoGroup) {
                cryptoHeaders = `
                                <th>⬆️</th>
                                <th>⬇️</th>
                                <th>Limit Order</th>
                                <th>Stake</th>
                                <th>Fusion</th>
                `;
            }

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
                                ${cryptoHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${group.assets.map(asset => {
                                let cryptoCells = '';
                                if (isCryptoGroup) {
                                    cryptoCells = `
                                    <td>${STATUS_SYMBOLS[asset.withdraw_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.deposit_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.limit_order]}</td>
                                    <td>${STATUS_SYMBOLS[asset.stakeable]}</td>
                                    <td>${STATUS_SYMBOLS[asset.fusion]}</td>
                                    `;
                                }
                                return `
                                <tr
                                    data-name="${asset.name.toLowerCase()}"
                                    data-symbol="${asset.symbol.toLowerCase()}"
                                    data-buy-active="${asset.buy_active}"
                                    data-sell-active="${asset.sell_active}"
                                    data-withdraw-active="${asset.withdraw_active}"
                                    data-deposit-active="${asset.deposit_active}"
                                    data-limit-order="${asset.limit_order}"
                                    data-stakeable="${asset.stakeable}"
                                    data-fusion="${asset.fusion}"
                                    data-maintenance="${asset.maintenance}"
                                    data-new="${asset.New}"
                                    ${asset.maintenance && maintenanceFilter ? 'style="background-color:rgba(255, 166, 0, 0.32);"' : ''}
                                >
                                    <td>${asset.name}${asset.maintenance ? ' 🚧' : ''}${asset.New ? ' 🆕' : ''}</td>
                                    <td>${asset.symbol}</td>
                                    <td>${STATUS_SYMBOLS[asset.buy_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.sell_active]}</td>
                                    ${cryptoCells}
                                </tr>
                            `}).join('')}
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

    let itemsToPin = [];

    // Calculate latest update for each component (needed for Rule 1 and Rule 2)
    const latestUpdatesByComponent = {};
    // Sort all updates by date (oldest to newest) to easily find the latest for each component
    const sortedUpdates = [...updates].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

    for (const update of sortedUpdates) {
        latestUpdatesByComponent[update.component_name] = update; // Overwrite with newer, so last one is latest
    }

    // 1. Pin the most recent maintenance that is still 'scheduled' or 'in_progress'.
    //    A maintenance is considered active if its *latest* update for that component
    //    is 'scheduled' or 'in_progress'.
    let newestActiveMaintenanceUpdate = null;
    for (const componentName in latestUpdatesByComponent) {
        const latestUpdateForComponent = latestUpdatesByComponent[componentName];
        if (latestUpdateForComponent.new_status === 'scheduled' || latestUpdateForComponent.new_status === 'in_progress') {
            if (!newestActiveMaintenanceUpdate || 
                new Date(latestUpdateForComponent.changed_at) > new Date(newestActiveMaintenanceUpdate.changed_at)) {
                newestActiveMaintenanceUpdate = latestUpdateForComponent;
            }
        }
    }
    if (newestActiveMaintenanceUpdate) {
        itemsToPin.push(newestActiveMaintenanceUpdate);
    }

    // 2. Pin newest "investigating" update for each component, if that's its latest status
    for (const componentName in latestUpdatesByComponent) {
        const latestUpdate = latestUpdatesByComponent[componentName];
        if (latestUpdate.new_status === 'investigating') {
            // Add to itemsToPin if not already there (e.g. from scheduled maintenance rule)
            if (!itemsToPin.includes(latestUpdate)) {
                itemsToPin.push(latestUpdate);
            }
        }
    }
    
    // Sort all pinned items by date (newest first) for rendering order
    itemsToPin.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

    // 3. `otherUpdates` are those not in `itemsToPin`
    const otherUpdates = updates.filter(u => !itemsToPin.includes(u));

    let tbodyHtml = '';

    // 4. Render pinned items
    itemsToPin.forEach(update => {
        const date = new Date(update.changed_at);
        const formattedDate = date.toLocaleString(undefined, {
            year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const hasDescription = update.description && update.description.trim() !== '';
        const pinnedIndicator = '📌 '; 

        // Using generic classes for pinned rows for easier selection/styling if needed
        tbodyHtml += `
            <tr class="toggle-description pinned-row${hasDescription ? ' has-description' : ''}" style="cursor: pointer;">
                <td>${pinnedIndicator}${update.component_name} ${hasDescription ? '<span class="desc-indicator" title="Show description">ℹ</span>' : ''}</td>
                <td>
                    <span class="status-badge">${formatStatusText(update.new_status)}</span>
                </td>
                <td>${formattedDate}</td>
            </tr>
            ${hasDescription ? `<tr class="description-row pinned-desc-row" style="display: none">
                <td colspan="3" style="text-align: left;">
                    <strong></strong> ${update.description}
                </td>
            </tr>` : ''}
        `;
    });

    // Render the rest of the updates
    tbodyHtml += otherUpdates.map(update => {
        const date = new Date(update.changed_at);
        const formattedDate = date.toLocaleString(undefined, {
            year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const hasDescription = update.description && update.description.trim() !== '';
        return `
            <tr class="toggle-description${hasDescription ? ' has-description' : ''}" style="cursor: pointer;">
                <td>${update.component_name} ${hasDescription ? '<span class="desc-indicator" title="Show description">ℹ</span>' : ''}</td>
                <td>
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
    }).join('');

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
                    ${tbodyHtml}
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
            // Ensure the next sibling is indeed a description row
            if (descriptionRow && (descriptionRow.classList.contains('description-row') || descriptionRow.classList.contains('pinned-desc-row'))) {
                const isVisible = descriptionRow.style.display === '';
                descriptionRow.style.display = isVisible ? 'none' : '';
            }
        });
    });
}

let cachedElements = null;

function initializeElementCache() {
    cachedElements = {
        assetSearch: document.getElementById('assetSearch'),
        maintenanceFilter: document.getElementById('maintenanceFilter'),
        tradeOnlyFilter: document.getElementById('tradeOnlyFilter'),
        fullyIntegratedFilter: document.getElementById('fullyIntegratedFilter'),
        stakeableFilter: document.getElementById('stakeableFilter'),
        newAssetsFilter: document.getElementById('newAssetsFilter'),
        fusionFilter: document.getElementById('fusionFilter'),
        assetGroups: document.getElementById('assetGroups'),
        noResults: document.getElementById('noResults')
    };
}

function filterAssets() {
    if (!cachedElements) initializeElementCache();
    
    const searchTerm = cachedElements.assetSearch.value.toLowerCase();
    const maintenanceFilter = cachedElements.maintenanceFilter.checked;
    const tradeOnlyFilter = cachedElements.tradeOnlyFilter.checked;
    const fullyIntegratedFilter = cachedElements.fullyIntegratedFilter.checked;
    const stakeableFilter = cachedElements.stakeableFilter.checked;
    const newAssetsFilter = cachedElements.newAssetsFilter?.checked;
    const fusionFilter = cachedElements.fusionFilter?.checked;

    const details = cachedElements.assetGroups.querySelectorAll('details');
    let totalVisible = 0;

    details.forEach(detail => {
        const tableBody = detail.querySelector('tbody');
        if (!tableBody) return;
        
        const rows = tableBody.querySelectorAll('tr');
        let visibleRows = 0;
        
        // Batch DOM updates - collect all changes first
        const rowUpdates = [];

        rows.forEach(row => {
            if (!row.querySelector('td')) return;

            const name = row.dataset.name || '';
            const symbol = row.dataset.symbol || '';
            const maintenance = row.dataset.maintenance === 'true';
            const withdraw = row.dataset.withdrawActive === 'true';
            const deposit = row.dataset.depositActive === 'true';
            const stakeable = row.dataset.stakeable === 'true';
            const isNew = row.dataset.new === 'true';
            const fusion = row.dataset.fusion === 'true';

            const matchesSearch = name.includes(searchTerm) || symbol.includes(searchTerm);
            const matchesMaintenance = !maintenanceFilter || maintenance;
            const matchesTradeOnly = !tradeOnlyFilter || (!withdraw && !deposit);
            const matchesFullyIntegrated = !fullyIntegratedFilter || (withdraw || deposit);
            const matchesStakeable = !stakeableFilter || stakeable;
            const matchesNewAssets = !newAssetsFilter || isNew;
            const matchesFusion = !fusionFilter || fusion;

            const isVisible = matchesSearch && matchesMaintenance && matchesTradeOnly && matchesFullyIntegrated && matchesStakeable && matchesNewAssets && matchesFusion;
            
            // Store the change instead of applying immediately
            rowUpdates.push({ row, isVisible });
            if (isVisible) visibleRows++;
        });

        // Apply all row visibility changes at once
        rowUpdates.forEach(({ row, isVisible }) => {
            row.style.display = isVisible ? '' : 'none';
        });

        const summary = detail.querySelector('summary');
        const originalText = summary.getAttribute('data-original-text') || summary.textContent;
        if (!summary.getAttribute('data-original-text')) {
            summary.setAttribute('data-original-text', originalText);
        }

        // Batch summary updates
        if (visibleRows > 0) {
            detail.style.display = '';
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

    cachedElements.noResults.style.display = totalVisible === 0 ? 'block' : 'none';

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
            if (prevNoResults) prevNoResults.remove();
            
            // Collect all update row changes
            const updateRowChanges = [];
            
            // Updated logic: iterate through all rows, pairing main and description rows only if present
            for (let i = 0; i < updateRows.length; ) {
                const row = updateRows[i];
                if (!row) break;
                if (!row.classList.contains('toggle-description')) {
                    i++;
                    continue;
                }
                const nameCell = row.querySelector('td');
                const statusCell = row.querySelectorAll('td')[1]; // Second td contains the status badge
                let descRow = null;
                if (updateRows[i + 1] && (updateRows[i + 1].classList.contains('description-row') || updateRows[i + 1].classList.contains('pinned-desc-row'))) {
                    descRow = updateRows[i + 1];
                }
                const descText = descRow && descRow.textContent ? descRow.textContent.toLowerCase() : '';
                const name = nameCell ? nameCell.textContent.toLowerCase() : '';
                const statusText = statusCell ? statusCell.textContent.toLowerCase() : '';

                // Match search in either the main row (component name) or the description row
                const matchesSearch = name.includes(searchTerm) || descText.includes(searchTerm) || statusText.includes(searchTerm);
                // Match stakeable filter if checked
                const matchesStakeable = !stakeableFilter || statusText.includes('stakeable');
                const matchesFusion = !fusionFilter || statusText.includes('fusion');
                const matchesNewAssets = !newAssetsFilter || statusText.includes('new');
                const matchesMaintenance = !maintenanceFilter || statusText.includes('maintenance');
                const matchesFullyIntegrated = !fullyIntegratedFilter || statusText.includes('deposit') || statusText.includes('withdraw');

                const rowIsVisible = matchesSearch && matchesStakeable && matchesFusion && matchesNewAssets && matchesMaintenance && matchesFullyIntegrated;
                
                // Store changes instead of applying immediately
                updateRowChanges.push({
                    row,
                    descRow,
                    isVisible: rowIsVisible
                });
                
                if (rowIsVisible) updatesVisible++;
                i += descRow ? 2 : 1;
            }

            // Apply all update row changes at once
            updateRowChanges.forEach(({ row, descRow, isVisible }) => {
                row.style.display = isVisible ? '' : 'none';
                if (descRow && !isVisible) {
                    descRow.style.display = 'none';
                }
            });

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
    // Initialize element cache
    initializeElementCache();
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
    const button = document.getElementById('theme-toggle');
    const themeIcon = button.querySelector('.theme-icon');
    themeIcon.innerHTML = theme === 'dark' ? '☀' : '🌑';

    // Set up event listeners using cached elements
    cachedElements.assetSearch.addEventListener('input', filterAssets);
    cachedElements.maintenanceFilter.addEventListener('change', filterAssets);
    cachedElements.tradeOnlyFilter.addEventListener('change', filterAssets);
    cachedElements.fullyIntegratedFilter.addEventListener('change', filterAssets);
    cachedElements.stakeableFilter.addEventListener('change', filterAssets);
    cachedElements.newAssetsFilter.addEventListener('change', filterAssets);
    cachedElements.fusionFilter.addEventListener('change', filterAssets);

    // Fetch initial data
    fetchAssetData();
});
