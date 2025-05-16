const STATUS_SYMBOLS = {
    true: '✅',
    false: '❌',
    null: '⚪'
};

async function fetchAssetData() {
    try {
        const [settingsResponse, currenciesResponse] = await Promise.all([
            fetch('https://api.bitpanda.com/v1/assets/settings'),
            fetch('https://api.bitpanda.com/v3/currencies')
        ]);

        const settings = await settingsResponse.json();
        const currencies = await currenciesResponse.json();

        console.log('Currencies data:', currencies.data.attributes);
        console.log('Settings data:', settings.data);

        // Combine the data
        const combinedAssets = processAssetData(settings, currencies);
        console.log('Combined assets:', combinedAssets);
        renderAssetGroups(combinedAssets);
    } catch (error) {
        console.error('Error fetching asset data:', error);
        document.getElementById('assetGroups').innerHTML = '<p class="error">Error loading asset data. Please try again later.</p>';
    }
}

function processAssetData(settings, currencies) {
    const assets = [];
    const currencyMap = new Map();

    // Process currencies first to create a map using pid
    console.log('Raw currency data:', currencies.data.attributes);
    
    // Get all possible currency types from the response
    const allCurrencies = Object.values(currencies.data.attributes)
        .filter(Array.isArray)
        .flat();
    
    console.log('Processed currencies:', allCurrencies);

    allCurrencies.forEach(currency => {
        console.log('Processing currency:', {
            id: currency.id,
            pid: currency.attributes.pid,
            name: currency.attributes.name,
            type: currency.attributes.asset_type_name,
            group: currency.attributes.asset_group_name
        });
        currencyMap.set(currency.attributes.pid || currency.id, {
            name: currency.attributes.name,
            symbol: currency.attributes.symbol,
            asset_type_name: currency.attributes.asset_type_name,
            asset_group_name: currency.attributes.asset_group_name
        });
    });

    // Process settings and combine with currency data
    settings.data.forEach(setting => {
        if (setting.type === "asset_settings" && setting.attributes) {
            const lookupId = setting.attributes.pid || setting.id;
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
        } else if (typeName === 'security') {
            typeName = 'Security';
        } else if (typeName === 'fiat') {
            typeName = 'Fiat';
        } else if (typeName === 'commodity') {
            typeName = 'Commodity';
        } else if (typeName === 'index') {
            typeName = 'Index';
        } else {
            typeName = typeName.capitalize();
        }

        let groupName = (asset.asset_group_name || '').toLowerCase();
        // Normalize group names
        if (['coin', 'token'].includes(groupName)) {
            groupName = 'Coin/Token';
        } else if (groupName === 'fiat_earn' || groupName === 'security_earn') {
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
    container.innerHTML = '';

    Object.entries(grouped)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([_, group]) => {
            const details = document.createElement('details');
            details.innerHTML = `
                <summary>${group.typeName} - ${group.groupName} (${group.assets.length} assets)</summary>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>Name</th>
                            <th>Symbol</th>
                            <th>Available</th>
                            <th>Buy</th>
                            <th>Sell</th>
                            <th>Maintenance</th>
                            <th>Withdraw</th>
                            <th>Deposit</th>
                            <th>Limit Order</th>
                        </tr>
                        ${group.assets.map(asset => `
                            <tr>
                                <td>${asset.name}</td>
                                <td>${asset.symbol}</td>
                                <td>${STATUS_SYMBOLS[asset.available]}</td>
                                <td>${STATUS_SYMBOLS[asset.buy_active]}</td>
                                <td>${STATUS_SYMBOLS[asset.sell_active]}</td>
                                <td>${STATUS_SYMBOLS[asset.maintenance_enabled]}</td>
                                <td>${STATUS_SYMBOLS[asset.withdraw_active]}</td>
                                <td>${STATUS_SYMBOLS[asset.deposit_active]}</td>
                                <td>${STATUS_SYMBOLS[asset.automated_order_active]}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
            container.appendChild(details);
        });
}

function filterAssets() {
    const searchInput = document.getElementById('assetSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const maintenanceFilter = document.getElementById('maintenanceFilter').checked;
    const tradeOnlyFilter = document.getElementById('tradeOnlyFilter').checked;
    const fullyIntegratedFilter = document.getElementById('fullyIntegratedFilter').checked;
    const details = document.querySelectorAll('details');
    const noResults = document.getElementById('noResults');
    let totalVisible = 0;

    details.forEach(detail => {
        const rows = detail.querySelectorAll('tr:not(:first-child)');
        let visibleRows = 0;

        rows.forEach(row => {
            const name = row.children[0].textContent.toLowerCase();
            const symbol = row.children[1].textContent.toLowerCase();
            const maintenance = row.children[5].textContent === '✅';
            const withdraw = row.children[6].textContent === '✅';
            const deposit = row.children[7].textContent === '✅';

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
            summary.textContent = `${originalText.split('(')[0]} (${visibleRows} assets)`;
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
    button.innerHTML = newTheme === 'dark' ? '☀' : '🌑';
}

// Add String.prototype.capitalize() if not exists
if (!String.prototype.capitalize) {
    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
    const button = document.getElementById('theme-toggle');
    button.innerHTML = theme === 'dark' ? '☀' : '🌑';

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
