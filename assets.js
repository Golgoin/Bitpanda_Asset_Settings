const STATUS_SYMBOLS = {
    true: '✅',
    false: '❌',
    null: '⚪'
};

async function fetchAssetData() {
    try {
        console.log('Starting API requests...');
        
        // Fetch asset settings and currencies data
        const [settingsResponse, currenciesResponse] = await Promise.all([
            fetch('https://api.bitpanda.com/v1/assets/settings'),
            fetch('https://api.bitpanda.com/v3/currencies')
        ]);
        
        console.log('API responses received:');
        console.log('Settings response status:', settingsResponse.status);
        console.log('Currencies response status:', currenciesResponse.status);
        
        // Check if responses are successful
        if (!settingsResponse.ok || !currenciesResponse.ok) {
            throw new Error(`API request failed: Settings (${settingsResponse.status}), Currencies (${currenciesResponse.status})`);
        }

        // Try to fetch updates from the API first, then fall back to local file if that fails
        let updates = [];
        try {
            const updatesResponse = await fetch('https://bitpanda.visionresources.info/updates');
            if (updatesResponse.ok) {
                updates = await updatesResponse.json();
                console.log('Updates loaded from API successfully');
            } else {
                throw new Error(`Updates API returned status: ${updatesResponse.status}`);
            }
        } catch (error) {
            console.warn('Failed to load updates from API, trying local fallback:', error);
            try {
                const localUpdatesResponse = await fetch('updates.json');
                if (localUpdatesResponse.ok) {
                    updates = await localUpdatesResponse.json();
                    console.log('Updates loaded from local file successfully');
                } else {
                    throw new Error(`Local updates file returned status: ${localUpdatesResponse.status}`);
                }
            } catch (localError) {
                console.error('Failed to load updates from local file:', localError);
                // updates remains an empty array
            }
        }

        // Process responses
        const settings = await settingsResponse.json();
        const currencies = await currenciesResponse.json();
        
        // Log full response structures for debugging
        console.log('Full settings response structure:', JSON.stringify(settings).slice(0, 200) + '...');
        console.log('Full currencies response structure:', JSON.stringify(currencies).slice(0, 200) + '...');
        console.log('Updates data:', updates);

        // Combine the data
        const combinedAssets = processAssetData(settings, currencies);
        console.log('Combined assets:', combinedAssets);
        
        const container = document.getElementById('assetGroups');
        container.innerHTML = '';
          const updatesContainer = document.getElementById('updatesSection');

        // Check if updates were successfully fetched
        if (updates && updates.length > 0) {
            // Render the updates table only if data was successfully retrieved
            renderUpdatesTable(updates, updatesContainer);
        } else {
            // Show a warning message about updates being unavailable
            const warningSection = document.createElement('div');
            warningSection.className = 'updates-section warning-section';
            warningSection.innerHTML = `
                <h2>Status Updates Unavailable</h2>
                <p class="updates-subtitle">Updates could not be loaded at this time</p>
                
                <div class="warning-card">
                    <div class="warning-icon">⚠️</div>
                    <div class="warning-content">
                        <p class="error">Unable to retrieve status updates.</p>
                        <p>This may be due to:</p>
                        <ul>
                            <li>CORS restrictions when running locally (use <code>run_local.bat</code>)</li>
                            <li>The updates service being temporarily unavailable</li>
                            <li>Network connectivity issues</li>
                        </ul>
                        <p class="warning-note">You can still view all asset data below.</p>
                    </div>
                </div>
            `;
            updatesContainer.appendChild(warningSection);
        }
        
        // Always render the asset groups
        renderAssetGroups(combinedAssets);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('assetGroups').innerHTML = '<p class="error">Error loading data. Please try again later.</p>';
    }
}

function processAssetData(settings, currencies) {
    const assets = [];
    const currencyMap = new Map();

    // Log data for debugging
    console.log('Settings data structure check:', settings.data ? 'Has data property' : 'No data property');
    console.log('Currencies data structure check:', currencies.data ? 'Has data property' : 'No data property');
    
    if (!settings.data || !currencies.data) {
        console.error('Invalid API response structure');
        return [];
    }
    
    // Check the structure of the currencies object
    if (currencies.data.attributes) {
        console.log('Raw currency data:', currencies.data.attributes);
        
        // Get all possible currency types from the response
        const allCurrencies = Object.values(currencies.data.attributes)
            .filter(Array.isArray)
            .flat();
        
        console.log('Processed currencies:', allCurrencies.length);
        
        // Process currencies
        allCurrencies.forEach(currency => {
            if (currency.attributes && currency.attributes.pid) {  // Only map currencies that have a PID
                console.log('Processing currency:', {
                    pid: currency.attributes.pid,
                    name: currency.attributes.name,
                    type: currency.attributes.asset_type_name,
                    group: currency.attributes.asset_group_name
                });
                currencyMap.set(currency.attributes.pid, {
                    name: currency.attributes.name,
                    symbol: currency.attributes.symbol,
                    asset_type_name: currency.attributes.asset_type_name,
                    asset_group_name: currency.attributes.asset_group_name
                });
            }
        });
    } else if (currencies.data.length > 0) {
        // Try alternate structure if the currency data has a different format
        console.log('Using alternate currency data structure');
        
        currencies.data.forEach(currency => {
            if (currency.attributes && currency.attributes.pid) {
                console.log('Processing currency (alt):', {
                    pid: currency.attributes.pid,
                    name: currency.attributes.name
                });
                currencyMap.set(currency.attributes.pid, {
                    name: currency.attributes.name,
                    symbol: currency.attributes.symbol,
                    asset_type_name: currency.attributes.asset_type_name || 'Unknown',
                    asset_group_name: currency.attributes.asset_group_name || 'Unknown'
                });
            }
        });
    } else {
        console.error('Could not determine currency data structure');
    }

    // Process settings and combine with currency data
    settings.data.forEach(setting => {
        if (setting.type === "asset_settings" && setting.attributes && setting.attributes.pid) {
            const lookupId = setting.attributes.pid;
            console.log('Looking up setting:', {
                id: setting.id,
                pid: setting.attributes.pid,
                lookupId: lookupId,
                found: currencyMap.has(lookupId)
            });
            const currencyData = currencyMap.get(lookupId);
            if (currencyData) {
                assets.push({
                    name: currencyData.name,
                    symbol: currencyData.symbol,
                    asset_type_name: currencyData.asset_type_name,
                    asset_group_name: currencyData.asset_group_name,
                    available: setting.attributes.available,
                    buy_active: setting.attributes.buy_active,
                    sell_active: setting.attributes.sell_active,
                    maintenance_enabled: setting.attributes.maintenance_enabled,
                    withdraw_active: setting.attributes.withdraw_active,
                    deposit_active: setting.attributes.deposit_active,
                    automated_order_active: setting.attributes.automated_order_active
                });
            }
        }
    });

    return assets;
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
                                <th>🚧</th>
                                <th>⬆️</th>
                                <th>⬇️</th>
                                <th>Limit Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.assets.map(asset => `
                                <tr>
                                    <td><strong>${asset.name}</strong></td>
                                    <td>${asset.symbol}</td>
                                    <td>${STATUS_SYMBOLS[asset.buy_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.sell_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.maintenance_enabled]}</td>
                                    <td>${STATUS_SYMBOLS[asset.withdraw_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.deposit_active]}</td>
                                    <td>${STATUS_SYMBOLS[asset.automated_order_active]}</td>
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
                    <span class="group-name">status.bitpanda.com</span>
                </div>
            </summary>
            <table>
                <thead>
                    <tr>
                        <th>Component</th>
                        <th>New Status</th>
                        <th>Changed At</th>
                    </tr>
                </thead>
                <tbody>
                    ${updates.map(update => {
                        // Determine status class for styling
                        let statusClass = 'status-neutral';
                        if (update.new_status === 'operational') {
                            statusClass = 'status-positive';
                        } else if (['degraded_performance', 'partial_outage', 'major_outage'].includes(update.new_status)) {
                            statusClass = 'status-negative';
                        }

                        // Format the date
                        const date = new Date(update.changed_at);
                        const formattedDate = date.toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        return `
                            <tr class="toggle-description" style="cursor: pointer;">
                                <td><strong>${update.component_name}</strong></td>                                
                                <td class="${statusClass}">
                                    <span class="status-badge">${formatStatusText(update.new_status)}</span>
                                </td>
                                <td>${formattedDate}</td>
                            </tr>
                            <tr class="description-row" style="display: none; background-color: inherit;">
                                <td colspan="3" style="text-align: left;">
                                    <strong>Description:</strong> ${update.description}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </details>
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
            const maintenance = cells[5].textContent === '✅';
            const withdraw = cells[6].textContent === '✅';
            const deposit = cells[7].textContent === '✅';

            const matchesSearch = name.includes(searchTerm) || symbol.includes(searchTerm);
            const matchesMaintenance = !maintenanceFilter || maintenance;
            const matchesTradeOnly = !tradeOnlyFilter || (!withdraw && !deposit);
            const matchesFullyIntegrated = !fullyIntegratedFilter || (withdraw || deposit);

            const isVisible = matchesSearch && matchesMaintenance && matchesTradeOnly && matchesFullyIntegrated;
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

    searchInput.addEventListener('input', filterAssets);
    maintenanceFilter.addEventListener('change', filterAssets);
    tradeOnlyFilter.addEventListener('change', filterAssets);
    fullyIntegratedFilter.addEventListener('change', filterAssets);

    // Fetch initial data
    fetchAssetData();
});
