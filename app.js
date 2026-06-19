const ACTIVITIES = [
  // Creative
  { id: 1, emoji: "🎨", title: "Doodle something random", desc: "Open a blank page and draw whatever comes to mind. No rules, no judgment — just let your hand move.", category: "creative", energy: "low", time: 5 },
  { id: 2, emoji: "✍️", title: "Write a 6-word story", desc: "Challenge yourself to tell a complete story in exactly six words. Hemingway supposedly invented this.", category: "creative", energy: "low", time: 5 },
  { id: 3, emoji: "📸", title: "Take interesting photos", desc: "Walk around your space and find 10 interesting shots. Look for light, texture, or odd angles.", category: "creative", energy: "medium", time: 30 },
  { id: 4, emoji: "🎶", title: "Make a playlist", desc: "Build the perfect playlist for a mood or activity — a road trip, a rainy day, or a Monday morning.", category: "creative", energy: "low", time: 30 },
  { id: 5, emoji: "🖊️", title: "Write a letter to future you", desc: "Seal it and set a reminder to open it in a year. What do you want to remember about today?", category: "creative", energy: "low", time: 30 },
  { id: 6, emoji: "🎭", title: "Rewrite a movie ending", desc: "Pick any film and write an alternate ending. What would YOU have done differently?", category: "creative", energy: "low", time: 60 },
  { id: 7, emoji: "🖼️", title: "Rearrange your space", desc: "Move furniture around, swap out decor, or just tidy and redecorate a single shelf.", category: "creative", energy: "high", time: 60 },

  // Active
  { id: 8, emoji: "🕺", title: "Have a solo dance party", desc: "Pick three of your favorite songs and dance like nobody's watching. Because nobody is.", category: "active", energy: "high", time: 5 },
  { id: 9, emoji: "🧘", title: "Do a 10-min yoga flow", desc: "Search 'beginner yoga 10 minutes' and follow along. Your back will thank you.", category: "active", energy: "low", time: 5 },
  { id: 10, emoji: "🚶", title: "Take a walk with no destination", desc: "Go outside and turn wherever feels right. No maps, no podcasts — just observe the world.", category: "active", energy: "medium", time: 30 },
  { id: 11, emoji: "💪", title: "7-minute workout", desc: "The classic scientific 7-minute circuit: jumping jacks, wall sit, push-ups, crunches... full body, no gear.", category: "active", energy: "high", time: 5 },
  { id: 12, emoji: "🤸", title: "Try 10 new stretches", desc: "Look up stretches you've never tried before. Focus on the spots that feel tight.", category: "active", energy: "low", time: 30 },
  { id: 13, emoji: "🏃", title: "Run to one landmark and back", desc: "Pick something visible from your place — a park, a sign, a corner — and sprint there and back.", category: "active", energy: "high", time: 30 },

  // Social
  { id: 14, emoji: "📞", title: "Call someone you miss", desc: "Don't text. Actually call someone you haven't talked to in a while. Five minutes is enough.", category: "social", energy: "low", time: 5 },
  { id: 15, emoji: "🎮", title: "Play an online game with a friend", desc: "Chess, Skribbl.io, Codenames — plenty of free multiplayer games that need zero setup.", category: "social", energy: "low", time: 30 },
  { id: 16, emoji: "🍕", title: "Organize a spontaneous hangout", desc: "Text three people 'are you free in an hour?' and see what happens. Low effort, high reward.", category: "social", energy: "medium", time: 60 },
  { id: 17, emoji: "💌", title: "Send an appreciation message", desc: "Text someone a specific thing you appreciate about them. Not a compliment — a genuine observation.", category: "social", energy: "low", time: 5 },
  { id: 18, emoji: "🎲", title: "Start a group trivia quiz", desc: "Use a free app or just look up trivia questions and quiz your group chat.", category: "social", energy: "low", time: 30 },

  // Learning
  { id: 19, emoji: "🌍", title: "Learn one fact about a random country", desc: "Pick a country at random on a map and read its Wikipedia intro. You'll end up knowing something genuinely interesting.", category: "learning", energy: "low", time: 5 },
  { id: 20, emoji: "🧠", title: "Watch a TED talk", desc: "Pick a topic you know nothing about and watch a 10-15 minute TED talk on it.", category: "learning", energy: "low", time: 30 },
  { id: 21, emoji: "🔤", title: "Learn 10 words in a new language", desc: "Use a free app or just a search. Try numbers, colors, or greetings in a language you've always wanted to speak.", category: "learning", energy: "low", time: 5 },
  { id: 22, emoji: "📚", title: "Read the first chapter of a book", desc: "Grab a book you've been meaning to read. Commit to just the first chapter. That's it.", category: "learning", energy: "low", time: 30 },
  { id: 23, emoji: "🍳", title: "Learn to cook one new dish", desc: "Find a simple recipe with ingredients you have and cook it. Doesn't have to be perfect.", category: "learning", energy: "medium", time: 60 },
  { id: 24, emoji: "🎸", title: "Learn a simple song on an instrument", desc: "Even if you can't play, look up a 'beginner tutorial' for guitar, piano, or ukulele on YouTube.", category: "learning", energy: "medium", time: 60 },
  { id: 25, emoji: "🔭", title: "Explore a Wikipedia rabbit hole", desc: "Open any Wikipedia article, click the first link in each article's body text, and keep going for 10 minutes.", category: "learning", energy: "low", time: 5 },

  // Chill
  { id: 26, emoji: "🛁", title: "Take a long bath or shower", desc: "Light a candle, put on music, and stay in way longer than necessary. You deserve it.", category: "chill", energy: "low", time: 30 },
  { id: 27, emoji: "📓", title: "Write in a journal", desc: "Free-write for 10 minutes. No topic, no structure — just write whatever comes to mind until time runs out.", category: "chill", energy: "low", time: 5 },
  { id: 28, emoji: "🌿", title: "Sit outside and do nothing", desc: "Find a spot outside and sit for 10 minutes without your phone. Just look at stuff. It's surprisingly good.", category: "chill", energy: "low", time: 5 },
  { id: 29, emoji: "🍵", title: "Make a fancy hot drink", desc: "Put real effort into a tea or coffee. Froth something, add a flavor, use the good mug.", category: "chill", energy: "low", time: 5 },
  { id: 30, emoji: "🎬", title: "Watch a short film", desc: "Go to Vimeo Staff Picks and watch one short film. Usually under 20 minutes and often stunning.", category: "chill", energy: "low", time: 30 },
  { id: 31, emoji: "🧩", title: "Do a puzzle", desc: "Physical jigsaw or digital — either way, it's oddly satisfying and kills time perfectly.", category: "chill", energy: "low", time: 60 },
  { id: 32, emoji: "😴", title: "Take a power nap", desc: "Set a timer for 20 minutes. Lie down, close your eyes. You might not sleep and that's fine.", category: "chill", energy: "low", time: 30 },
  { id: 33, emoji: "🌙", title: "Plan your ideal trip", desc: "Pick a destination you'll probably never go to and plan the whole trip: flights, hotels, itinerary. Treat it seriously.", category: "chill", energy: "low", time: 60 },
];

const TIME_LABEL = { 5: "~5 min", 30: "~30 min", 60: "1 hr+" };
const ENERGY_LABEL = { low: "Low energy 😪", medium: "Medium energy 🙂", high: "High energy 🔥" };

let filters = { energy: "all", time: "all", category: "all" };
let favorites = JSON.parse(localStorage.getItem("boredom-faves") || "[]");
let currentFeatured = null;

function saveFavorites() {
  localStorage.setItem("boredom-faves", JSON.stringify(favorites));
}

function isSaved(id) {
  return favorites.includes(id);
}

function toggleFave(id) {
  if (isSaved(id)) {
    favorites = favorites.filter(f => f !== id);
  } else {
    favorites.push(id);
  }
  saveFavorites();
}

function getFiltered() {
  return ACTIVITIES.filter(a => {
    if (filters.energy !== "all" && a.energy !== filters.energy) return false;
    if (filters.time !== "all" && a.time !== Number(filters.time)) return false;
    if (filters.category !== "all" && a.category !== filters.category) return false;
    return true;
  });
}

function makeMetaTag(text) {
  const span = document.createElement("span");
  span.className = "meta-tag";
  span.textContent = text;
  return span;
}

function renderFeatured(activity) {
  const card = document.getElementById("featured-card");
  document.getElementById("feat-emoji").textContent = activity.emoji;
  document.getElementById("feat-title").textContent = activity.title;
  document.getElementById("feat-desc").textContent = activity.desc;
  document.getElementById("feat-time").textContent = TIME_LABEL[activity.time];
  document.getElementById("feat-energy").textContent = ENERGY_LABEL[activity.energy];
  document.getElementById("feat-category").textContent = activity.category.charAt(0).toUpperCase() + activity.category.slice(1);

  const saveBtn = document.getElementById("feat-save");
  saveBtn.textContent = isSaved(activity.id) ? "❤️" : "♡";
  saveBtn.className = "icon-btn" + (isSaved(activity.id) ? " saved" : "");
  saveBtn.onclick = () => {
    toggleFave(activity.id);
    renderFeatured(activity);
    renderGrid();
    renderFavorites();
  };

  card.classList.remove("hidden");
  // Retrigger animation
  card.style.animation = "none";
  void card.offsetHeight;
  card.style.animation = "";
  currentFeatured = activity;
}

function surpriseMe() {
  const pool = getFiltered();
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  renderFeatured(pick);
}

function makeActivityCard(activity) {
  const card = document.createElement("div");
  card.className = "activity-card";
  card.innerHTML = `
    <span class="emoji">${activity.emoji}</span>
    <h3>${activity.title}</h3>
    <p>${activity.desc}</p>
    <div class="card-meta">
      <span class="meta-tag">${TIME_LABEL[activity.time]}</span>
      <span class="meta-tag">${activity.category}</span>
    </div>
    <button class="save-btn ${isSaved(activity.id) ? "saved" : ""}" title="Save to favorites">
      ${isSaved(activity.id) ? "❤️" : "🤍"}
    </button>
  `;

  card.querySelector(".save-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFave(activity.id);
    renderGrid();
    renderFavorites();
    if (currentFeatured && currentFeatured.id === activity.id) renderFeatured(activity);
  });

  card.addEventListener("click", () => renderFeatured(activity));
  return card;
}

function renderGrid() {
  const grid = document.getElementById("activity-grid");
  grid.innerHTML = "";
  const items = getFiltered();

  if (!items.length) {
    const msg = document.createElement("p");
    msg.className = "no-results";
    msg.textContent = "No activities match your filters. Try broadening them!";
    grid.appendChild(msg);
    return;
  }

  items.forEach(a => grid.appendChild(makeActivityCard(a)));
}

function renderFavorites() {
  const section = document.getElementById("favorites-section");
  const grid = document.getElementById("favorites-grid");
  grid.innerHTML = "";

  if (!favorites.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  const faveActivities = ACTIVITIES.filter(a => favorites.includes(a.id));
  faveActivities.forEach(a => grid.appendChild(makeActivityCard(a)));
}

function setupFilters() {
  ["energy-filter", "time-filter", "category-filter"].forEach(groupId => {
    const key = groupId.split("-")[0];
    document.getElementById(groupId).addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      document.querySelectorAll(`#${groupId} .filter-btn`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filters[key] = btn.dataset.value;
      renderGrid();
    });
  });
}

document.getElementById("surprise-btn").addEventListener("click", surpriseMe);
document.getElementById("feat-next").addEventListener("click", surpriseMe);
document.getElementById("clear-faves").addEventListener("click", () => {
  favorites = [];
  saveFavorites();
  renderGrid();
  renderFavorites();
  if (currentFeatured) renderFeatured(currentFeatured);
});

setupFilters();
renderGrid();
renderFavorites();
