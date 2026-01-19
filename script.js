// Configuration
const CONFIG = {
    GNEWS_API_KEY: 'bea02426fb330008691f353533eb2384', // Replace with your actual API key
    GNEWS_BASE_URL: 'https://gnews.io/api/v4/',
    DEFAULT_QUERY: '(AI OR Artificial Intelligence OR Machine Learning OR Robotics OR Technology)',
    ARTICLES_PER_PAGE: 9,
    DEFAULT_CATEGORY: 'ai'
};

// State Management
let state = {
    articles: [],
    filteredArticles: [],
    currentPage: 1,
    currentCategory: 'all',
    searchQuery: '',
    isLoading: false
};

// DOM Elements
const elements = {
    articlesContainer: document.getElementById('articlesContainer'),
    searchInput: document.getElementById('searchInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    articleCount: document.getElementById('articleCount'),
    lastUpdate: document.getElementById('lastUpdate'),
    currentPage: document.getElementById('currentPage'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    systemLog: document.getElementById('systemLog'),
    apiStatus: document.getElementById('apiStatus'),
    visitorCount: document.getElementById('visitorCount')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    updateSystemLog('> Initializing NeuraScan System...', 'info');
    updateSystemLog('> Loading modules...', 'info');
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize visitor count
    initializeVisitorCount();
    
    // Test API connection
    const apiConnected = await testAPIConnection();
    
    // Load articles
    if (apiConnected) {
        await loadArticles();
    } else {
        // If API fails, load demo data
        updateSystemLog('> API connection failed, loading demo data...', 'warning');
        loadDemoData();
    }
    
    updateSystemLog('> System ready. Awaiting commands...', 'success');
}

function setupEventListeners() {
    // Search functionality
    elements.searchInput.addEventListener('input', debounce(handleSearch, 500));
    
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        updateSystemLog('> Manual refresh requested...', 'info');
        loadArticles();
    });
    
    // Category navigation
    document.querySelectorAll('.nav-link, .category-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.currentTarget.dataset.category;
            handleCategoryChange(category);
        });
    });
    
    // View controls
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            handleViewChange(e.currentTarget.dataset.view);
        });
    });
    
    // Pagination
    elements.prevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderArticles();
        }
    });
    
    elements.nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(state.filteredArticles.length / CONFIG.ARTICLES_PER_PAGE);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderArticles();
        }
    });
}

async function testAPIConnection() {
    try {
        updateSystemLog('> Testing API connection...', 'info');
        
        // Check if API key is set
        if (!CONFIG.GNEWS_API_KEY || CONFIG.GNEWS_API_KEY === 'YOUR_GNEWS_API_KEY_HERE') {
            updateSystemLog('> WARNING: API key not configured', 'warning');
            updateSystemLog('> Using demo data. Add your GNews API key to script.js', 'info');
            elements.apiStatus.style.background = '#ffa500'; // Orange for warning
            return false;
        }
        
        // Test a simple API call
        const testUrl = `${CONFIG.GNEWS_BASE_URL}search?q=test&token=${CONFIG.GNEWS_API_KEY}&lang=en&max=1`;
        
        const response = await fetch(testUrl, { timeout: 5000 });
        
        if (response.ok) {
            const data = await response.json();
            if (data.errors) {
                updateSystemLog(`> API Error: ${data.errors[0]?.message || 'Unknown error'}`, 'error');
                elements.apiStatus.style.background = '#ff4757'; // Red for error
                return false;
            }
            
            updateSystemLog('> API: CONNECTED', 'success');
            elements.apiStatus.classList.add('online');
            elements.apiStatus.style.background = 'var(--accent)';
            return true;
        } else {
            updateSystemLog(`> API Connection Failed: HTTP ${response.status}`, 'error');
            elements.apiStatus.style.background = '#ff4757';
            return false;
        }
    } catch (error) {
        console.error('API Test Error:', error);
        updateSystemLog('> API: CONNECTION FAILED - Network error', 'error');
        elements.apiStatus.style.background = '#ff4757';
        return false;
    }
}

async function loadArticles() {
    if (state.isLoading) return;
    
    state.isLoading = true;
    state.currentPage = 1;
    
    updateSystemLog('> Fetching latest intelligence...', 'info');
    showLoadingState();
    
    // Check if API key is properly set
    if (!CONFIG.GNEWS_API_KEY || CONFIG.GNEWS_API_KEY === 'YOUR_GNEWS_API_KEY_HERE') {
        updateSystemLog('> ERROR: API key not configured', 'error');
        updateSystemLog('> Please add your GNews API key to script.js', 'info');
        updateSystemLog('> Using demo data for now...', 'info');
        state.isLoading = false;
        loadDemoData();
        return;
    }
    
    try {
        // Build the API URL
        const query = state.searchQuery || CONFIG.DEFAULT_QUERY;
        const url = `${CONFIG.GNEWS_BASE_URL}search?q=${encodeURIComponent(query)}&token=${CONFIG.GNEWS_API_KEY}&lang=en&max=30`;
        
        updateSystemLog(`> Querying: ${query.substring(0, 50)}...`, 'info');
        
        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 401) {
            throw new Error('Invalid API key - Check your GNews API key');
        }
        
        if (response.status === 429) {
            throw new Error('API rate limit exceeded - Try again later');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.errors) {
            throw new Error(`API Error: ${JSON.stringify(data.errors)}`);
        }
        
        if (data.articles && data.articles.length > 0) {
            // Process and categorize articles
            state.articles = data.articles.map(article => ({
                title: article.title || 'Untitled',
                description: article.description || 'No description available.',
                content: article.content || '',
                url: article.url || '#',
                image: article.image || null,
                source: {
                    name: article.source?.name || 'Unknown Source',
                    url: article.source?.url || '#'
                },
                id: generateId(),
                category: categorizeArticle(article),
                publishedAt: formatDate(article.publishedAt)
            }));
            
            updateSystemLog(`> Retrieved ${state.articles.length} intelligence reports`, 'success');
            updateArticleCount();
            filterArticles();
            renderArticles();
            updateLastUpdateTime();
            updateCategoryCounts();
            
        } else {
            updateSystemLog('> No articles found for current query', 'info');
            loadDemoData(); // Fallback to demo data
        }
        
    } catch (error) {
        console.error('Error loading articles:', error);
        
        if (error.name === 'AbortError') {
            updateSystemLog('> ERROR: Request timeout - Network issue', 'error');
        } else if (error.message.includes('API key')) {
            updateSystemLog('> ERROR: Invalid or missing API key', 'error');
            updateSystemLog('> Get a free key from: https://gnews.io/', 'info');
        } else if (error.message.includes('rate limit')) {
            updateSystemLog('> ERROR: API rate limit reached', 'error');
            updateSystemLog('> Using demo data temporarily...', 'info');
        } else {
            updateSystemLog(`> ERROR: ${error.message}`, 'error');
        }
        
        // Fallback to demo data
        loadDemoData();
    } finally {
        state.isLoading = false;
    }
}

function categorizeArticle(article) {
    const title = (article.title || '').toLowerCase();
    const content = (article.content || '').toLowerCase();
    const description = (article.description || '').toLowerCase();
    
    const text = title + ' ' + description + ' ' + content;
    
    // Define keywords for each category
    const categories = {
        'ai': ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'chatgpt', 'gpt', 'llm', 'openai'],
        'robotics': ['robot', 'robotics', 'automation', 'drone', 'autonomous', 'boston dynamics', 'humanoid'],
        'cybersecurity': ['cyber', 'security', 'hack', 'hacker', 'encryption', 'malware', 'ransomware', 'data breach'],
        'quantum': ['quantum', 'qubit', 'quantum computing', 'quantum physics', 'superposition'],
        'tech': ['technology', 'tech', 'innovation', 'startup', 'silicon valley', 'tech news']
    };
    
    // Count matches for each category
    let maxMatches = 0;
    let selectedCategory = 'tech'; // Default
    
    for (const [category, keywords] of Object.entries(categories)) {
        let matches = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                matches++;
            }
        }
        
        if (matches > maxMatches) {
            maxMatches = matches;
            selectedCategory = category;
        }
    }
    
    return selectedCategory;
}

function formatDate(dateString) {
    if (!dateString) return 'Recent';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffHours < 168) { // Less than 7 days
            const days = Math.floor(diffHours / 24);
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    } catch {
        return 'Recent';
    }
}

// Demo data function for fallback
function loadDemoData() {
    updateSystemLog('> Loading demonstration data...', 'info');
    
    const demoArticles = [
        {
            title: "OpenAI Unveils GPT-5: Next Generation AI Model",
            description: "OpenAI announces GPT-5 with significant improvements in reasoning and multimodal capabilities, pushing the boundaries of artificial intelligence.",
            content: "The new model demonstrates unprecedented performance in complex reasoning tasks and shows improved safety features.",
            source: { name: "TechCrunch", url: "https://techcrunch.com" },
            url: "https://techcrunch.com",
            image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            category: "ai"
        },
        {
            title: "Boston Dynamics Announces New Atlas Robot with AI Integration",
            description: "The latest humanoid robot features advanced AI for autonomous decision-making and complex task execution in industrial environments.",
            content: "Atlas now features enhanced mobility and can perform complex manipulation tasks in unstructured environments.",
            source: { name: "Wired", url: "https://wired.com" },
            url: "https://wired.com",
            image: "https://images.unsplash.com/photo-1678931561580-7dcc8f7e5b3a?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            category: "robotics"
        },
        {
            title: "Quantum Computing Breakthrough Achieves 1000 Qubits",
            description: "Researchers achieve a major milestone in quantum computing, bringing practical quantum applications closer to reality.",
            content: "The breakthrough reduces error rates significantly, making quantum computing more viable for real-world applications.",
            source: { name: "Nature", url: "https://nature.com" },
            url: "https://nature.com",
            image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            category: "quantum"
        },
        {
            title: "Neuralink's First Human Trial Shows Promising Results",
            description: "Initial results from Neuralink's brain-computer interface trial demonstrate successful neural signal transmission and decoding.",
            content: "Patients with paralysis were able to control digital devices using only their thoughts.",
            source: { name: "The Verge", url: "https://theverge.com" },
            url: "https://theverge.com",
            image: "https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            category: "ai"
        },
        {
            title: "Autonomous Delivery Robots Approved for Citywide Deployment",
            description: "Major city approves expansion of autonomous delivery robots, revolutionizing last-mile logistics and reducing traffic congestion.",
            content: "The robots can navigate sidewalks and crosswalks safely, delivering packages within 30 minutes.",
            source: { name: "Forbes", url: "https://forbes.com" },
            url: "https://forbes.com",
            image: "https://images.unsplash.com/photo-1544319733-053e92c8d5a0?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            category: "robotics"
        },
        {
            title: "New AI Algorithm Can Predict Protein Folding in Minutes",
            description: "Breakthrough in computational biology allows AI to predict protein structures with unprecedented speed and accuracy.",
            content: "This advancement could accelerate drug discovery and understanding of genetic diseases.",
            source: { name: "Science Journal", url: "https://science.org" },
            url: "https://science.org",
            image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
            category: "ai"
        },
        {
            title: "Cybersecurity Firm Discovers Critical Zero-Day Vulnerability",
            description: "Major security flaw discovered in widely used enterprise software, affecting millions of systems worldwide.",
            content: "The vulnerability allows remote code execution and requires immediate patching.",
            source: { name: "Security Weekly", url: "https://securityweekly.com" },
            url: "https://securityweekly.com",
            image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            category: "cybersecurity"
        },
        {
            title: "Tesla Unveils Next-Generation Humanoid Robot Prototype",
            description: "Tesla's Optimus robot demonstrates new capabilities including object manipulation and environmental navigation.",
            content: "The robot can now perform complex manufacturing tasks with human-like dexterity.",
            source: { name: "Tesla Blog", url: "https://tesla.com" },
            url: "https://tesla.com",
            image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
            category: "robotics"
        },
        {
            title: "Major Tech Companies Form AI Ethics Consortium",
            description: "Leading tech companies establish consortium to develop ethical guidelines for AI development and deployment.",
            content: "The consortium aims to address bias, transparency, and accountability in AI systems.",
            source: { name: "Tech Ethics Review", url: "https://techethics.org" },
            url: "https://techethics.org",
            image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800",
            publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            category: "ai"
        }
    ];
    
    state.articles = demoArticles.map(article => ({
        ...article,
        id: generateId(),
        category: article.category,
        publishedAt: formatDate(article.publishedAt)
    }));
    
    updateSystemLog(`> Loaded ${state.articles.length} demo articles`, 'success');
    updateArticleCount();
    filterArticles();
    renderArticles();
    updateLastUpdateTime();
    updateCategoryCounts();
}

function filterArticles() {
    if (state.currentCategory === 'all') {
        state.filteredArticles = state.articles;
    } else {
        state.filteredArticles = state.articles.filter(article => 
            article.category === state.currentCategory
        );
    }
    
    // Apply search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        state.filteredArticles = state.filteredArticles.filter(article =>
            article.title.toLowerCase().includes(query) ||
            article.description.toLowerCase().includes(query) ||
            article.content.toLowerCase().includes(query)
        );
    }
}

function renderArticles() {
    const startIndex = (state.currentPage - 1) * CONFIG.ARTICLES_PER_PAGE;
    const endIndex = startIndex + CONFIG.ARTICLES_PER_PAGE;
    const articlesToShow = state.filteredArticles.slice(startIndex, endIndex);
    
    elements.articlesContainer.innerHTML = '';
    
    if (articlesToShow.length === 0) {
        elements.articlesContainer.innerHTML = `
            <div class="loading-article">
                <div class="pulse-loader"></div>
                <p>NO INTELLIGENCE FOUND FOR CURRENT FILTERS</p>
                <button class="cyber-btn-sm" style="margin-top: 1rem;" onclick="loadArticles()">RETRY CONNECTION</button>
            </div>
        `;
        return;
    }
    
    articlesToShow.forEach(article => {
        const articleElement = createArticleCard(article);
        elements.articlesContainer.appendChild(articleElement);
    });
    
    // Update pagination
    elements.currentPage.textContent = state.currentPage;
    updatePaginationButtons();
}

function createArticleCard(article) {
    const categoryColors = {
        'ai': '#0ff0fc',
        'robotics': '#ff00ff',
        'tech': '#00ff9d',
        'cybersecurity': '#ff9d00',
        'quantum': '#9d00ff'
    };
    
    const color = categoryColors[article.category] || '#0ff0fc';
    
    const card = document.createElement('div');
    card.className = 'article-card';
    card.innerHTML = `
        <div class="article-category" style="background: rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2); color: ${color};">${article.category.toUpperCase()}</div>
        <div class="article-content">
            <div class="article-source">
                <div class="source-icon" style="background: ${color};"></div>
                <span>${article.source.name}</span>
            </div>
            <h3 class="article-title">${article.title}</h3>
            <p class="article-description">${article.description}</p>
            <div class="article-meta">
                <span class="article-date">${article.publishedAt}</span>
                <a href="${article.url}" target="_blank" class="read-more" style="color: ${color};">ACCESS →</a>
            </div>
        </div>
    `;
    
    return card;
}

function updateSystemLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.textContent = `> ${message}`;
    
    switch (type) {
        case 'error':
            logEntry.style.color = '#ff4757';
            break;
        case 'success':
            logEntry.style.color = 'var(--accent)';
            break;
        case 'warning':
            logEntry.style.color = '#ffa500';
            break;
        case 'info':
            logEntry.style.color = 'var(--primary)';
            break;
        default:
            logEntry.style.color = 'var(--accent)';
    }
    
    elements.systemLog.appendChild(logEntry);
    
    // Keep only last 10 log entries
    const entries = elements.systemLog.children;
    if (entries.length > 10) {
        elements.systemLog.removeChild(entries[0]);
    }
    
    elements.systemLog.scrollTop = elements.systemLog.scrollHeight;
}

function updateArticleCount() {
    elements.articleCount.textContent = state.articles.length;
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    elements.lastUpdate.textContent = timeString;
}

function updateCategoryCounts() {
    const counts = {
        all: state.articles.length,
        ai: state.articles.filter(a => a.category === 'ai').length,
        robotics: state.articles.filter(a => a.category === 'robotics').length,
        tech: state.articles.filter(a => a.category === 'tech').length,
        cybersecurity: state.articles.filter(a => a.category === 'cybersecurity').length,
        quantum: state.articles.filter(a => a.category === 'quantum').length
    };
    
    document.querySelectorAll('.category-count').forEach(element => {
        const category = element.closest('.category-item').dataset.category;
        element.textContent = counts[category] || 0;
    });
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(state.filteredArticles.length / CONFIG.ARTICLES_PER_PAGE);
    
    elements.prevPage.disabled = state.currentPage === 1;
    elements.nextPage.disabled = state.currentPage === totalPages || totalPages === 0;
    
    elements.prevPage.style.opacity = elements.prevPage.disabled ? '0.5' : '1';
    elements.nextPage.style.opacity = elements.nextPage.disabled ? '0.5' : '1';
}

function handleSearch() {
    state.searchQuery = elements.searchInput.value.trim();
    if (state.searchQuery) {
        updateSystemLog(`> Searching for: "${state.searchQuery}"`, 'info');
    } else {
        updateSystemLog('> Clearing search filter', 'info');
    }
    filterArticles();
    state.currentPage = 1;
    renderArticles();
}

function handleCategoryChange(category) {
    // Update active states
    document.querySelectorAll('.nav-link, .category-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.category === category) {
            item.classList.add('active');
        }
    });
    
    // Update state and render
    state.currentCategory = category;
    updateSystemLog(`> Filtering: ${category.toUpperCase()} intelligence`, 'info');
    filterArticles();
    state.currentPage = 1;
    renderArticles();
}

function handleViewChange(view) {
    updateSystemLog(`> Changing view to: ${view.toUpperCase()} MODE`, 'info');
    
    const container = elements.articlesContainer;
    container.className = 'articles-grid';
    
    switch(view) {
        case 'list':
            container.style.gridTemplateColumns = '1fr';
            break;
        case 'compact':
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
            break;
        case 'grid':
        default:
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
            break;
    }
}

function showLoadingState() {
    elements.articlesContainer.innerHTML = `
        <div class="loading-article">
            <div class="pulse-loader"></div>
            <p>CONNECTING TO NEWS NETWORK...</p>
        </div>
    `;
}

function initializeVisitorCount() {
    // Generate a random visitor count for demo purposes
    const baseCount = 1428;
    const randomIncrement = Math.floor(Math.random() * 100);
    elements.visitorCount.textContent = (baseCount + randomIncrement).toString().padStart(4, '0');
    
    // Simulate occasional updates
    setInterval(() => {
        const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const current = parseInt(elements.visitorCount.textContent);
        const newCount = Math.max(1400, current + change);
        elements.visitorCount.textContent = newCount.toString().padStart(4, '0');
    }, 10000);
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Add fetch timeout polyfill
if (!fetch.timeout) {
    fetch.timeout = function(url, options, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Request timeout'));
            }, timeout);
            
            fetch(url, { ...options, signal: controller.signal })
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timeoutId));
        });
    };
}

// Debug function
function debugAPI() {
    console.log('=== NEURASCAN DEBUG INFO ===');
    console.log('API Key configured:', CONFIG.GNEWS_API_KEY && CONFIG.GNEWS_API_KEY !== 'YOUR_GNEWS_API_KEY_HERE');
    console.log('API Key (first 5 chars):', CONFIG.GNEWS_API_KEY ? CONFIG.GNEWS_API_KEY.substring(0, 5) + '...' : 'Not set');
    console.log('Total articles:', state.articles.length);
    console.log('Filtered articles:', state.filteredArticles.length);
    console.log('Current category:', state.currentCategory);
    console.log('Search query:', state.searchQuery);
    console.log('Current page:', state.currentPage);
    console.log('Is loading:', state.isLoading);
    console.log('===========================');
    
    updateSystemLog('> Debug info printed to console', 'info');
}

// Auto-refresh every 5 minutes
setInterval(() => {
    if (!state.isLoading && document.visibilityState === 'visible') {
        updateSystemLog('> Auto-refreshing intelligence...', 'info');
        loadArticles();
    }
}, 300000); // 5 minutes

// Update time every second
setInterval(updateLastUpdateTime, 1000);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + R to refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        updateSystemLog('> Keyboard refresh triggered', 'info');
        loadArticles();
    }
    
    // / to focus search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        elements.searchInput.focus();
        updateSystemLog('> Search focus activated', 'info');
    }
    
    // Escape to clear search
    if (e.key === 'Escape' && document.activeElement === elements.searchInput) {
        elements.searchInput.value = '';
        handleSearch();
    }
});

// Add visibility change handler
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Refresh when tab becomes visible after 30 seconds
        setTimeout(() => {
            if (!state.isLoading) {
                updateSystemLog('> Tab activated, refreshing data...', 'info');
                loadArticles();
            }
        }, 30000);
    }
});
