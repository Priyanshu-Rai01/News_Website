// ── DOM refs ──
const generalBtn      = document.getElementById("General");
const businessBtn     = document.getElementById("Business");
const sportsBtn       = document.getElementById("Sports");
const technologyBtn   = document.getElementById("Technology");
const entertainmentBtn= document.getElementById("Entertainment");
const analyticsBtn    = document.getElementById("AnalyticsBtn");
const searchBtn       = document.getElementById("searchBtn");
const newsQuery       = document.getElementById("newsQuery");
const newsType        = document.getElementById("newsType");
const newsdetails     = document.getElementById("newsdetails");

// ── State ──
let newsDataArr       = [];
let currentArticle    = null;
let qaConversation    = [];
let userPrefs         = JSON.parse(localStorage.getItem("prNewsPrefs") || '["technology"]');

// ── API URLs ──
const BASE_URL = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
  ? "http://localhost:3000" : "";

const HEADLINES_NEWS    = `${BASE_URL}/news`;
const GENERAL_NEWS      = `${BASE_URL}/news/general`;
const BUSINESS_NEWS     = `${BASE_URL}/news/business`;
const SPORTS_NEWS       = `${BASE_URL}/news/sports`;
const TECHNOLOGY_NEWS   = `${BASE_URL}/news/technology`;
const ENTERTAINMENT_NEWS= `${BASE_URL}/news/entertainment`;
const SEARCH_NEWS       = `${BASE_URL}/search?q=`;

// ── ANTHROPIC API (proxied via backend) ──
const CLAUDE_URL = `${BASE_URL}/claude`;

async function callClaude(systemPrompt, userPrompt, conversationHistory = []) {
  const messages = [
    ...conversationHistory,
    { role: "user", content: userPrompt }
  ];
  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages
    })
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "No response received.";
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
window.onload = function () {
  newsType.innerHTML = "<h4>Headlines</h4>";
  fetchNews(HEADLINES_NEWS);
  initPrefChips();
  loadTrending();
};

// ════════════════════════════════════════
//  NAV LISTENERS
// ════════════════════════════════════════
const navMap = [
  [generalBtn,       "<h4>General News</h4>",       GENERAL_NEWS      ],
  [businessBtn,      "<h4>Business News</h4>",       BUSINESS_NEWS     ],
  [sportsBtn,        "<h4>Sports News</h4>",         SPORTS_NEWS       ],
  [technologyBtn,    "<h4>Technology News</h4>",     TECHNOLOGY_NEWS   ],
  [entertainmentBtn, "<h4>Entertainment News</h4>",  ENTERTAINMENT_NEWS],
];

navMap.forEach(([btn, label, url]) => {
  if (btn) btn.addEventListener("click", () => {
    showMainNews();
    newsType.innerHTML = label;
    fetchNews(url);
    loadTrendingFor(url);
  });
});

if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    const query = newsQuery.value.trim();
    if (query) {
      showMainNews();
      newsType.innerHTML = `<h4>Search: ${query}</h4>`;
      fetchNews(`${SEARCH_NEWS}${encodeURIComponent(query)}`);
    }
  });
}

if (analyticsBtn) {
  analyticsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleAnalytics();
  });
}

// ════════════════════════════════════════
//  FETCH + DISPLAY NEWS
// ════════════════════════════════════════
async function fetchNews(URL) {
  newsdetails.innerHTML = "<h3>Loading…</h3>";
  try {
    const response = await fetch(URL);
    const data = await response.json();
    if (data.status === "ok" && data.articles?.length) {
      newsDataArr = data.articles;
      displayNews();
      updateAnalytics(newsDataArr);
    } else {
      newsdetails.innerHTML = `<h3 style="color:red;">${data.message || "No data found"}</h3>`;
    }
  } catch (err) {
    newsdetails.innerHTML = `<h3 style="color:red;">Failed to fetch news</h3>`;
  }
}

function displayNews() {
  newsdetails.innerHTML = "";
  if (!newsDataArr?.length) {
    newsdetails.innerHTML = "<h5>No data found.</h5>";
    return;
  }
  newsDataArr.forEach((news, i) => {
    const date = news.publishedAt ? news.publishedAt.split("T")[0] : "No Date";
    const col  = document.createElement("div");
    col.className = "col-sm-12 col-md-6 col-lg-4 col-xl-3 p-2";

    col.innerHTML = `
      <div class="card h-100 shadow">
        <div class="card-img-wrapper">
          <img class="card-img-top" src="${news.image || news.urlToImage || 'https://via.placeholder.com/300x200?text=No+Image'}"
               alt="${news.title || ''}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
          <div class="card-img-overlay-btns">
            <button class="overlay-btn" data-idx="${i}" data-mode="summary" title="AI Summary">✦ Summary</button>
            <button class="overlay-btn" data-idx="${i}" data-mode="qa" title="Ask AI">💬 Ask AI</button>
            <button class="overlay-btn overlay-btn-tts" data-idx="${i}" title="Read Aloud">🔊 Listen</button>
          </div>
        </div>
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${news.title || "No Title"}</h5>
          <h6 class="text-primary">${date}</h6>
          <p class="card-text text-muted">${news.description || "No Description Available"}</p>
          <div class="card-actions mt-auto">
            <a class="btn btn-dark" href="${news.url}" target="_blank">Read More</a>
          </div>
        </div>
      </div>`;
    newsdetails.appendChild(col);
  });

  // attach overlay button listeners
  document.querySelectorAll(".overlay-btn:not(.overlay-btn-tts)").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx  = parseInt(btn.dataset.idx);
      const mode = btn.dataset.mode;
      openAiModal(newsDataArr[idx], mode);
    });
  });

  document.querySelectorAll(".overlay-btn-tts").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const article = newsDataArr[idx];
      const text = `${article.title}. ${article.description || ""}`;
      openTtsModal(text, article.title);
    });
  });
}

// ════════════════════════════════════════
//  AI MODAL  (Summary + Ask AI)
// ════════════════════════════════════════
const aiModalOverlay = document.getElementById("aiModalOverlay");
const aiModalBody    = document.getElementById("aiModalBody");
const aiModalTitle   = document.getElementById("aiModalArticleTitle");
const aiModalMode    = document.getElementById("aiModalMode");
const aiModalQA      = document.getElementById("aiModalQA");
const aiQaInput      = document.getElementById("aiQaInput");
const aiQaSend       = document.getElementById("aiQaSend");
const aiQaHistory    = document.getElementById("aiQaHistory");

document.getElementById("aiModalClose").addEventListener("click", closeAiModal);
aiModalOverlay.addEventListener("click", (e) => { if (e.target === aiModalOverlay) closeAiModal(); });

function openAiModal(article, mode) {
  currentArticle  = article;
  qaConversation  = [];
  aiQaHistory.innerHTML = "";
  aiModalTitle.textContent = article.title || "Article";
  aiModalQA.style.display = mode === "qa" ? "block" : "none";
  aiModalMode.textContent = mode === "qa" ? "Ask AI About This Article" : "AI News Summary";
  aiModalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";

  if (mode === "summary") generateSummary(article);
  else {
    aiModalBody.innerHTML = `<p class="ai-intro-msg">Ask me anything about this article — context, implications, key people, or what it means for you.</p>`;
  }
}

function closeAiModal() {
  aiModalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

async function generateSummary(article) {
  aiModalBody.innerHTML = `<div class="ai-thinking"><div class="ai-dots"><span></span><span></span><span></span></div><p>Generating summary…</p></div>`;

  const articleText = `Title: ${article.title}\nDescription: ${article.description || ""}\nSource: ${article.source?.name || ""}`;
  const system = "You are a world-class news analyst. Respond in clean HTML using <p>, <strong>, <ul>, <li> tags. Be concise and insightful.";
  const prompt  = `Summarize this news article in 3 sections:
1. **What happened** (2-3 sentences)
2. **Why it matters** (2-3 sentences)
3. **Key takeaways** (3 bullet points)

Article:
${articleText}`;

  try {
    const result = await callClaude(system, prompt);
    aiModalBody.innerHTML = `<div class="ai-result">${result}</div>`;
  } catch (e) {
    aiModalBody.innerHTML = `<p class="ai-error">Could not generate summary. Check your API key.</p>`;
  }
}

aiQaSend.addEventListener("click", sendQA);
aiQaInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendQA(); });

async function sendQA() {
  const q = aiQaInput.value.trim();
  if (!q || !currentArticle) return;
  aiQaInput.value = "";

  appendQaBubble("user", q);
  const thinkingId = appendQaBubble("ai", `<div class="ai-thinking-inline"><span></span><span></span><span></span></div>`);

  const articleContext = `Article Title: ${currentArticle.title}\nDescription: ${currentArticle.description || ""}\nSource: ${currentArticle.source?.name || ""}\nURL: ${currentArticle.url}`;
  const system = `You are a helpful news assistant. The user is asking about a specific article. Keep answers concise and informative. Respond in plain text.

Article context:
${articleContext}`;

  qaConversation.push({ role: "user", content: q });

  try {
    const answer = await callClaude(system, q, qaConversation.slice(0, -1));
    qaConversation.push({ role: "assistant", content: answer });
    updateQaBubble(thinkingId, answer);
  } catch (e) {
    updateQaBubble(thinkingId, "Sorry, I couldn't process that. Check your API key.");
  }
}

let qaBubbleCounter = 0;
function appendQaBubble(role, html) {
  const id = `qab-${++qaBubbleCounter}`;
  const div = document.createElement("div");
  div.className = `qa-bubble qa-${role}`;
  div.id = id;
  div.innerHTML = html;
  aiQaHistory.appendChild(div);
  aiQaHistory.scrollTop = aiQaHistory.scrollHeight;
  return id;
}
function updateQaBubble(id, html) {
  const el = document.getElementById(id);
  if (el) { el.innerHTML = html; aiQaHistory.scrollTop = aiQaHistory.scrollHeight; }
}

// ════════════════════════════════════════
//  PERSONALIZED FEED
// ════════════════════════════════════════
function initPrefChips() {
  const chips = document.querySelectorAll(".pref-chip");
  chips.forEach(chip => {
    if (userPrefs.includes(chip.dataset.cat)) chip.classList.add("active");
    else chip.classList.remove("active");

    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
      userPrefs = Array.from(document.querySelectorAll(".pref-chip.active")).map(c => c.dataset.cat);
      localStorage.setItem("prNewsPrefs", JSON.stringify(userPrefs));
    });
  });

  document.getElementById("loadFeedBtn").addEventListener("click", loadPersonalizedFeed);
}

async function loadPersonalizedFeed() {
  if (!userPrefs.length) { alert("Select at least one category!"); return; }
  showMainNews();
  newsType.innerHTML = `<h4>📌 Your Personalized Feed</h4>`;
  newsdetails.innerHTML = "<h3>Curating your feed…</h3>";

  const results = await Promise.all(userPrefs.map(cat =>
    fetch(`${BASE_URL}/news/${cat}`).then(r => r.json()).catch(() => ({ articles: [] }))
  ));

  const allArticles = results.flatMap(r => r.articles || []);
  // shuffle and take top 12
  newsDataArr = allArticles.sort(() => Math.random() - 0.5).slice(0, 12);

  if (newsDataArr.length) {
    displayNews();
    // AI-rank the feed headline
    generateFeedInsight(newsDataArr.slice(0, 5));
  } else {
    newsdetails.innerHTML = "<h5>No articles found for your preferences.</h5>";
  }
}

async function generateFeedInsight(articles) {
  const titles = articles.map((a, i) => `${i+1}. ${a.title}`).join("\n");
  const banner = document.createElement("div");
  banner.className = "feed-insight-banner";
  banner.innerHTML = `<span class="ai-spark">✦</span> <em>Generating your feed insight…</em>`;
  newsdetails.insertAdjacentElement("beforebegin", banner);

  try {
    const result = await callClaude(
      "You are a news editor. Be concise, max 2 sentences.",
      `Given these top stories from a user's personalized feed, write a punchy 1-2 sentence overview of what's dominating the news in their interest areas:\n${titles}`
    );
    banner.innerHTML = `<span class="ai-spark">✦</span> <strong>AI Feed Digest:</strong> ${result}`;
  } catch {
    banner.remove();
  }
}

// ════════════════════════════════════════
//  TRENDING NEWS SECTION
// ════════════════════════════════════════
async function loadTrending() {
  try {
    const res  = await fetch(HEADLINES_NEWS);
    const data = await res.json();
    if (data.articles?.length) renderTrending(data.articles.slice(0, 8));
  } catch {}
}

async function loadTrendingFor(url) {
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.articles?.length) renderTrending(data.articles.slice(0, 8));
  } catch {}
}

function renderTrending(articles) {
  const strip = document.getElementById("trendingStrip");
  const pills = document.getElementById("trendingPills");
  pills.innerHTML = "";
  articles.forEach((a, i) => {
    const btn = document.createElement("button");
    btn.className = "trending-pill";
    btn.innerHTML = `<span class="trend-rank">${i+1}</span> ${truncate(a.title, 55)}`;
    btn.addEventListener("click", () => {
      window.open(a.url, "_blank");
    });
    pills.appendChild(btn);
  });
  strip.style.display = "block";

  // AI trending label on top story
  labelTopTrend(articles[0]);
}

async function labelTopTrend(article) {
  try {
    const label = await callClaude(
      "You are a trend analyst. Reply with ONLY a 2-4 word punchy label, like 'Market Shockwave' or 'Tech Rivalry Heats Up'. No quotes.",
      `Label this trending news story: ${article.title}`
    );
    const firstPill = document.querySelector(".trending-pill");
    if (firstPill) {
      const badge = document.createElement("span");
      badge.className = "trend-ai-badge";
      badge.textContent = label.trim();
      firstPill.appendChild(badge);
    }
  } catch {}
}

// ════════════════════════════════════════
//  ANALYTICS DASHBOARD
// ════════════════════════════════════════
function toggleAnalytics() {
  const panel   = document.getElementById("analyticsPanel");
  const wrapper = document.getElementById("mainNewsWrapper");
  const strip   = document.getElementById("trendingStrip");
  const isOpen  = panel.style.display !== "none";

  if (isOpen) {
    panel.style.display = "none";
    wrapper.style.display = "block";
    strip.style.display = "block";
    analyticsBtn.classList.remove("active");
  } else {
    panel.style.display = "block";
    wrapper.style.display = "none";
    strip.style.display = "none";
    analyticsBtn.classList.add("active");
    if (newsDataArr.length) renderAnalytics(newsDataArr);
    else fetchAndAnalyze();
  }
}

async function fetchAndAnalyze() {
  document.getElementById("analyticsGrid").innerHTML = `<p class="analytics-loading">Fetching data…</p>`;
  const res  = await fetch(HEADLINES_NEWS);
  const data = await res.json();
  if (data.articles) { newsDataArr = data.articles; renderAnalytics(newsDataArr); }
}

function updateAnalytics(articles) {
  const panel = document.getElementById("analyticsPanel");
  if (panel.style.display !== "none") renderAnalytics(articles);
}

async function renderAnalytics(articles) {
  const grid = document.getElementById("analyticsGrid");

  // ── compute stats ──
  const sources   = {};
  const dates     = {};
  const wordFreq  = {};
  const withImage = articles.filter(a => a.image || a.urlToImage).length;

  const stopWords = new Set(["the","a","an","in","of","on","to","for","is","it","as","at","by","be","or","and","with","that","this","from","was","has","are","will","have","its","not","his","her","their","said","after","but","about","more","also","new","over","up","can","into","when","than","been","were","all","they","he","she","we","you","i","one","two","three","us","our","who","what","how","why","amid","per","vs"]);

  articles.forEach(a => {
    const src = a.source?.name || "Unknown";
    sources[src] = (sources[src] || 0) + 1;

    const day = a.publishedAt ? a.publishedAt.split("T")[0] : "Unknown";
    dates[day] = (dates[day] || 0) + 1;

    const words = (a.title || "").toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
    words.forEach(w => { if (w.length > 3 && !stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1; });
  });

  const topSources = Object.entries(sources).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const topWords   = Object.entries(wordFreq).sort((a,b) => b[1]-a[1]).slice(0, 12);
  const sortedDays = Object.entries(dates).sort((a,b) => a[0].localeCompare(b[0])).slice(-7);
  const maxCount   = Math.max(...topSources.map(s => s[1]), 1);
  const maxDay     = Math.max(...sortedDays.map(d => d[1]), 1);

  // ── AI narrative ──
  let aiNarrative = "";
  try {
    aiNarrative = await callClaude(
      "You are a data journalist. Be concise, max 3 sentences, no markdown.",
      `Analyze these news stats and give a brief insight:\n- Total articles: ${articles.length}\n- Top sources: ${topSources.slice(0,3).map(s=>`${s[0]}(${s[1]})`).join(", ")}\n- Top topics by word frequency: ${topWords.slice(0,5).map(w=>w[0]).join(", ")}\n- Articles with images: ${withImage}/${articles.length}`
    );
  } catch { aiNarrative = ""; }

  grid.innerHTML = `
    ${aiNarrative ? `<div class="analytics-ai-insight"><span class="ai-spark">✦</span> <strong>AI Insight:</strong> ${aiNarrative}</div>` : ""}

    <div class="analytics-card">
      <div class="analytics-card-title">📰 Total Articles</div>
      <div class="analytics-big-num">${articles.length}</div>
      <div class="analytics-sub">${withImage} with images · ${articles.length - withImage} text only</div>
    </div>

    <div class="analytics-card analytics-card-wide">
      <div class="analytics-card-title">🏢 Top Sources</div>
      <div class="analytics-bars">
        ${topSources.map(([name, count]) => `
          <div class="abar-row">
            <div class="abar-label">${name}</div>
            <div class="abar-track">
              <div class="abar-fill" style="width:${(count/maxCount)*100}%"></div>
            </div>
            <div class="abar-count">${count}</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="analytics-card analytics-card-wide">
      <div class="analytics-card-title">📅 Articles by Date</div>
      <div class="analytics-day-chart">
        ${sortedDays.map(([day, count]) => `
          <div class="day-col">
            <div class="day-bar-wrap">
              <div class="day-bar" style="height:${Math.max(4,(count/maxDay)*80)}px" title="${count} articles"></div>
            </div>
            <div class="day-label">${day.slice(5)}</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="analytics-card">
      <div class="analytics-card-title">🔑 Hot Keywords</div>
      <div class="analytics-keywords">
        ${topWords.map(([word, count]) => `
          <span class="kw-chip" style="font-size:${Math.min(1.1, 0.7 + count*0.08)}rem">${word} <em>${count}</em></span>`).join("")}
      </div>
    </div>
  `;
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function showMainNews() {
  document.getElementById("analyticsPanel").style.display = "none";
  document.getElementById("mainNewsWrapper").style.display = "block";
  document.getElementById("trendingStrip").style.display = "block";
  if (analyticsBtn) analyticsBtn.classList.remove("active");
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + "…" : str;
}


// ════════════════════════════════════════
//  TEXT TO AUDIO  (Web Speech API)
// ════════════════════════════════════════
const ttsModalOverlay = document.getElementById("ttsModalOverlay");
const ttsTextarea     = document.getElementById("ttsTextarea");
const ttsVoiceSelect  = document.getElementById("ttsVoiceSelect");
const ttsPlayBtn      = document.getElementById("ttsPlayBtn");
const ttsPauseBtn     = document.getElementById("ttsPauseBtn");
const ttsStopBtn      = document.getElementById("ttsStopBtn");
const ttsClearBtn     = document.getElementById("ttsClearBtn");
const ttsStatus       = document.getElementById("ttsStatus");
const ttsRateSlider   = document.getElementById("ttsRate");
const ttsPitchSlider  = document.getElementById("ttsPitch");
const ttsVolSlider    = document.getElementById("ttsVolume");
const ttsProgressWrap = document.getElementById("ttsProgressWrap");
const ttsProgressBar  = document.getElementById("ttsProgressBar");
const ttsNavBtn       = document.getElementById("TtsNavBtn");

let ttsUtterance  = null;
let ttsPaused     = false;
let ttsWords      = [];
let ttsWordIndex  = 0;

// ── Populate voices ──
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  ttsVoiceSelect.innerHTML = "";
  const engVoices = voices.filter(v => v.lang.startsWith("en"));
  const list = engVoices.length ? engVoices : voices;
  list.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.default) opt.selected = true;
    ttsVoiceSelect.appendChild(opt);
  });
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// ── Open modal ──
function openTtsModal(text = "", articleTitle = "") {
  ttsTextarea.value = text || "";
  const info = document.getElementById("ttsArticleInfo");
  const titleEl = document.getElementById("ttsArticleTitleText");
  if (articleTitle) {
    titleEl.textContent = articleTitle;
    info.style.display = "flex";
  } else {
    info.style.display = "none";
  }
  ttsModalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  setTtsStatus("Ready");
  resetTtsUI();
}

function closeTtsModal() {
  speechSynthesis.cancel();
  ttsModalOverlay.classList.remove("open");
  document.body.style.overflow = "";
  resetTtsUI();
}

document.getElementById("ttsModalClose").addEventListener("click", closeTtsModal);
ttsModalOverlay.addEventListener("click", (e) => { if (e.target === ttsModalOverlay) closeTtsModal(); });

// ── TTS Nav button opens blank modal ──
if (ttsNavBtn) {
  ttsNavBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openTtsModal();
  });
}

// ── Play ──
ttsPlayBtn.addEventListener("click", () => {
  const text = ttsTextarea.value.trim();
  if (!text) { setTtsStatus("⚠ Please enter some text first."); return; }

  if (ttsPaused && speechSynthesis.paused) {
    speechSynthesis.resume();
    ttsPaused = false;
    ttsPlayBtn.disabled = true;
    ttsPauseBtn.disabled = false;
    setTtsStatus("▶ Resuming…");
    return;
  }

  speechSynthesis.cancel();
  const voices = speechSynthesis.getVoices();
  const engVoices = voices.filter(v => v.lang.startsWith("en"));
  const list = engVoices.length ? engVoices : voices;

  ttsUtterance = new SpeechSynthesisUtterance(text);
  ttsUtterance.voice  = list[ttsVoiceSelect.value] || voices[0];
  ttsUtterance.rate   = parseFloat(ttsRateSlider.value);
  ttsUtterance.pitch  = parseFloat(ttsPitchSlider.value);
  ttsUtterance.volume = parseFloat(ttsVolSlider.value);

  // progress tracking
  ttsWords = text.split(/\s+/);
  ttsWordIndex = 0;
  ttsProgressWrap.style.display = "block";
  ttsProgressBar.style.width = "0%";

  ttsUtterance.onboundary = (e) => {
    if (e.name === "word") {
      ttsWordIndex++;
      const pct = Math.min(100, (ttsWordIndex / ttsWords.length) * 100);
      ttsProgressBar.style.width = pct + "%";
    }
  };

  ttsUtterance.onstart = () => {
    setTtsStatus("🔊 Reading aloud…");
    ttsPlayBtn.disabled  = true;
    ttsPauseBtn.disabled = false;
    ttsStopBtn.disabled  = false;
  };

  ttsUtterance.onend = () => {
    setTtsStatus("✅ Done!");
    ttsProgressBar.style.width = "100%";
    resetTtsUI();
  };

  ttsUtterance.onerror = (e) => {
    setTtsStatus("❌ Error: " + e.error);
    resetTtsUI();
  };

  speechSynthesis.speak(ttsUtterance);
});

// ── Pause ──
ttsPauseBtn.addEventListener("click", () => {
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    ttsPaused = true;
    ttsPlayBtn.disabled  = false;
    ttsPlayBtn.textContent = "▶ Resume";
    ttsPauseBtn.disabled = true;
    setTtsStatus("⏸ Paused");
  }
});

// ── Stop ──
ttsStopBtn.addEventListener("click", () => {
  speechSynthesis.cancel();
  ttsPaused = false;
  resetTtsUI();
  ttsProgressBar.style.width = "0%";
  setTtsStatus("⏹ Stopped");
});

// ── Clear ──
ttsClearBtn.addEventListener("click", () => {
  speechSynthesis.cancel();
  ttsTextarea.value = "";
  const info = document.getElementById("ttsArticleInfo");
  info.style.display = "none";
  resetTtsUI();
  ttsProgressBar.style.width = "0%";
  setTtsStatus("Ready");
});

// ── Slider labels ──
ttsRateSlider.addEventListener("input",  () => document.getElementById("ttsRateVal").textContent  = parseFloat(ttsRateSlider.value).toFixed(1));
ttsPitchSlider.addEventListener("input", () => document.getElementById("ttsPitchVal").textContent = parseFloat(ttsPitchSlider.value).toFixed(1));
ttsVolSlider.addEventListener("input",   () => document.getElementById("ttsVolVal").textContent   = Math.round(ttsVolSlider.value * 100));

// ── Helpers ──
function setTtsStatus(msg) { ttsStatus.textContent = msg; }

function resetTtsUI() {
  ttsPaused = false;
  ttsPlayBtn.disabled  = false;
  ttsPlayBtn.textContent = "▶ Play";
  ttsPauseBtn.disabled = true;
  ttsStopBtn.disabled  = true;
}