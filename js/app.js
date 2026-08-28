"use strict";

const STORAGE_KEY = "habit-tracker-v1";

const ICONS = {
  book: "B",
  code: "C",
  sport: "S",
  water: "W",
  sleep: "Z",
  study: "D",
  other: "•"
};

const state = {
  habits: loadHabits(),
  selectedDate: startOfDay(new Date()),
  editingId: null
};

const elements = {
  todayButton: document.querySelector("#today-button"),
  addButton: document.querySelector("#add-habit-button"),

  todayProgress: document.querySelector("#today-progress"),
  todayCount: document.querySelector("#today-count"),
  activeCount: document.querySelector("#active-count"),
  bestStreak: document.querySelector("#best-streak"),

  dateLabel: document.querySelector("#date-label"),
  habitList: document.querySelector("#habit-list"),
  weekGrid: document.querySelector("#week-grid"),

  dialog: document.querySelector("#habit-dialog"),
  form: document.querySelector("#habit-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelDialog: document.querySelector("#cancel-dialog"),

  name: document.querySelector("#habit-name"),
  frequency: document.querySelector("#habit-frequency"),
  icon: document.querySelector("#habit-icon"),
  editingId: document.querySelector("#editing-id"),

  toast: document.querySelector("#toast")
};

initialize();

function initialize() {
  bindEvents();
  render();
}

function bindEvents() {
  elements.todayButton.addEventListener("click", () => {
    state.selectedDate = startOfDay(new Date());
    render();
  });

  elements.addButton.addEventListener("click", () => {
    openCreateDialog();
  });

  elements.closeDialog.addEventListener("click", closeDialog);
  elements.cancelDialog.addEventListener("click", closeDialog);

  elements.form.addEventListener("submit", handleFormSubmit);

  elements.habitList.addEventListener("click", handleHabitAction);

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeDialog();
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
}

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const demo = createDemoHabits();
      saveHabits(demo);
      return demo;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isValidHabit)
      .map(normalizeHabit);
  } catch (error) {
    console.warn("Could not load habits:", error);
    return [];
  }
}

function createDemoHabits() {
  return [
    {
      id: crypto.randomUUID(),
      name: "Read for 20 minutes",
      frequency: "daily",
      icon: "book",
      completed: getDemoCompletion()
    },
    {
      id: crypto.randomUUID(),
      name: "Practice coding",
      frequency: "daily",
      icon: "code",
      completed: getDemoCompletion()
    },
    {
      id: crypto.randomUUID(),
      name: "Football training",
      frequency: "weekly",
      icon: "sport",
      completed: {}
    }
  ];
}

function getDemoCompletion() {
  const completion = {};

  for (let offset = 1; offset <= 3; offset++) {
    const date = addDays(new Date(), -offset);
    completion[toDateKey(date)] = true;
  }

  return completion;
}

function isValidHabit(habit) {
  return (
    habit &&
    typeof habit === "object" &&
    typeof habit.name === "string" &&
    habit.name.trim().length > 0 &&
    ["daily", "weekdays", "weekly"].includes(habit.frequency) &&
    typeof habit.icon === "string" &&
    habit.completed &&
    typeof habit.completed === "object"
  );
}

function normalizeHabit(habit) {
  return {
    id: habit.id || crypto.randomUUID(),
    name: habit.name.trim(),
    frequency: habit.frequency,
    icon: ICONS[habit.icon] ? habit.icon : "other",
    completed: { ...habit.completed }
  };
}

function saveHabits(habits = state.habits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    return true;
  } catch (error) {
    console.error("Could not save habits:", error);
    showToast("Could not save your changes");
    return false;
  }
}

function render() {
  renderDate();
  renderStats();
  renderHabits();
  renderWeek();
}

function renderDate() {
  elements.dateLabel.textContent =
    state.selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
}

function renderStats() {
  const activeHabits = state.habits.filter((habit) =>
    isScheduled(habit, state.selectedDate)
  );

  const completed = activeHabits.filter((habit) =>
    isCompleted(habit, state.selectedDate)
  ).length;

  const percentage = activeHabits.length
    ? Math.round((completed / activeHabits.length) * 100)
    : 0;

  elements.todayProgress.textContent = `${percentage}%`;
  elements.todayCount.textContent =
    `${completed} of ${activeHabits.length} completed`;

  elements.activeCount.textContent = state.habits.length;

  const best = state.habits.reduce((max, habit) => {
    return Math.max(max, calculateStreak(habit));
  }, 0);

  elements.bestStreak.textContent = best;
}

function renderHabits() {
  elements.habitList.replaceChildren();

  const scheduled = state.habits.filter((habit) =>
    isScheduled(habit, state.selectedDate)
  );

  if (!scheduled.length) {
    elements.habitList.appendChild(
      createEmptyMessage(
        state.habits.length
          ? "No habits are scheduled for this day."
          : "No habits yet. Add your first habit."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  scheduled.forEach((habit) => {
    fragment.appendChild(createHabitElement(habit));
  });

  elements.habitList.appendChild(fragment);
}

function createHabitElement(habit) {
  const article = document.createElement("article");
  article.className = "habit";
  article.dataset.id = habit.id;

  const icon = document.createElement("span");
  icon.className = "habit-icon";
  icon.textContent = ICONS[habit.icon] || "•";

  const info = document.createElement("div");
  info.className = "habit-info";

  const name = document.createElement("p");
  name.className = "habit-name";
  name.textContent = habit.name;

  const meta = document.createElement("div");
  meta.className = "habit-meta";

  const frequency = document.createElement("span");
  frequency.textContent = formatFrequency(habit.frequency);

  const streak = document.createElement("span");
  const currentStreak = calculateStreak(habit);
  streak.textContent = `${currentStreak} day${currentStreak === 1 ? "" : "s"} streak`;

  meta.append(frequency, streak);
  info.append(name, meta);

  const actions = document.createElement("div");
  actions.className = "habit-actions";

  const edit = document.createElement("button");
  edit.className = "edit-button";
  edit.type = "button";
  edit.dataset.action = "edit";
  edit.setAttribute("aria-label", `Edit ${habit.name}`);
  edit.textContent = "⋯";

  const remove = document.createElement("button");
  remove.className = "remove-button";
  remove.type = "button";
  remove.dataset.action = "remove";
  remove.setAttribute("aria-label", `Delete ${habit.name}`);
  remove.textContent = "×";

  const check = document.createElement("button");
  check.className = "check-button";
  check.type = "button";
  check.dataset.action = "toggle";
  check.setAttribute(
    "aria-label",
    isCompleted(habit, state.selectedDate)
      ? `Mark ${habit.name} incomplete`
      : `Mark ${habit.name} complete`
  );

  if (isCompleted(habit, state.selectedDate)) {
    check.classList.add("completed");
    check.textContent = "✓";
  }

  actions.append(edit, remove, check);
  article.append(icon, info, actions);

  return article;
}

function renderWeek() {
  elements.weekGrid.replaceChildren();

  const weekStart = getWeekStart(state.selectedDate);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 7; index++) {
    const date = addDays(weekStart, index);
    fragment.appendChild(createDayElement(date));
  }

  elements.weekGrid.appendChild(fragment);
}

function createDayElement(date) {
  const element = document.createElement("div");
  element.className = "day";

  if (isSameDay(date, state.selectedDate)) {
    element.classList.add("today");
  }

  if (isDayComplete(date)) {
    element.classList.add("complete");
  }

  const name = document.createElement("span");
  name.className = "day-name";
  name.textContent = date.toLocaleDateString("en-US", {
    weekday: "short"
  }).slice(0, 2);

  const number = document.createElement("span");
  number.className = "day-number";
  number.textContent = date.getDate();

  element.append(name, number);

  return element;
}

function isDayComplete(date) {
  const scheduled = state.habits.filter((habit) =>
    isScheduled(habit, date)
  );

  if (!scheduled.length) {
    return false;
  }

  return scheduled.every((habit) =>
    isCompleted(habit, date)
  );
}

function handleHabitAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const habitElement = button.closest(".habit");

  if (!habitElement) {
    return;
  }

  const habit = state.habits.find(
    (item) => item.id === habitElement.dataset.id
  );

  if (!habit) {
    return;
  }

  const action = button.dataset.action;

  if (action === "toggle") {
    toggleHabit(habit);
  }

  if (action === "edit") {
    openEditDialog(habit);
  }

  if (action === "remove") {
    removeHabit(habit);
  }
}

function toggleHabit(habit) {
  const key = toDateKey(state.selectedDate);
  const previous = habit.completed[key];

  if (previous) {
    delete habit.completed[key];
  } else {
    habit.completed[key] = true;
  }

  if (!saveHabits()) {
    if (previous) {
      habit.completed[key] = true;
    } else {
      delete habit.completed[key];
    }
    return;
  }

  render();
  showToast(previous ? "Habit unchecked" : "Habit completed");
}

function removeHabit(habit) {
  const confirmed = window.confirm(
    `Delete "${habit.name}"? This will remove its history.`
  );

  if (!confirmed) {
    return;
  }

  const index = state.habits.findIndex(
    (item) => item.id === habit.id
  );

  const [removed] = state.habits.splice(index, 1);

  if (!saveHabits()) {
    state.habits.splice(index, 0, removed);
    return;
  }

  render();
  showToast("Habit deleted");
}

function openCreateDialog() {
  state.editingId = null;

  elements.dialogTitle.textContent = "Add habit";
  elements.form.reset();
  elements.editingId.value = "";

  elements.dialog.showModal();

  requestAnimationFrame(() => {
    elements.name.focus();
  });
}

function openEditDialog(habit) {
  state.editingId = habit.id;

  elements.dialogTitle.textContent = "Edit habit";
  elements.name.value = habit.name;
  elements.frequency.value = habit.frequency;
  elements.icon.value = habit.icon;
  elements.editingId.value = habit.id;

  elements.dialog.showModal();

  requestAnimationFrame(() => {
    elements.name.focus();
  });
}

function closeDialog() {
  if (elements.dialog.open) {
    elements.dialog.close();
  }

  state.editingId = null;
}

function handleFormSubmit(event) {
  event.preventDefault();

  const name = elements.name.value.trim();
  const frequency = elements.frequency.value;
  const icon = elements.icon.value;

  if (!name) {
    showToast("Enter a habit name");
    elements.name.focus();
    return;
  }

  if (state.editingId) {
    updateHabit(state.editingId, name, frequency, icon);
  } else {
    addHabit(name, frequency, icon);
  }
}

function addHabit(name, frequency, icon) {
  const habit = {
    id: crypto.randomUUID(),
    name,
    frequency,
    icon,
    completed: {}
  };

  state.habits.push(habit);

  if (!saveHabits()) {
    state.habits.pop();
    return;
  }

  closeDialog();
  render();
  showToast("Habit added");
}

function updateHabit(id, name, frequency, icon) {
  const habit = state.habits.find((item) => item.id === id);

  if (!habit) {
    return;
  }

  const previous = {
    name: habit.name,
    frequency: habit.frequency,
    icon: habit.icon
  };

  habit.name = name;
  habit.frequency = frequency;
  habit.icon = icon;

  if (!saveHabits()) {
    Object.assign(habit, previous);
    return;
  }

  closeDialog();
  render();
  showToast("Habit updated");
}

function isScheduled(habit, date) {
  const day = date.getDay();

  if (habit.frequency === "daily") {
    return true;
  }

  if (habit.frequency === "weekdays") {
    return day >= 1 && day <= 5;
  }

  if (habit.frequency === "weekly") {
    return day === 1;
  }

  return true;
}

function isCompleted(habit, date) {
  return habit.completed[toDateKey(date)] === true;
}

function calculateStreak(habit) {
  let streak = 0;
  let cursor = startOfDay(new Date());

  if (
    isScheduled(habit, cursor) &&
    !isCompleted(habit, cursor)
  ) {
    cursor = addDays(cursor, -1);
  }

  for (let i = 0; i < 1000; i++) {
    if (!isScheduled(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }

    if (!isCompleted(habit, cursor)) {
      break;
    }

    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function formatFrequency(frequency) {
  const labels = {
    daily: "Every day",
    weekdays: "Weekdays",
    weekly: "Weekly"
  };

  return labels[frequency] || frequency;
}

function createEmptyMessage(message) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = message;
  return element;
}

function startOfDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function addDays(date, amount) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount
  );
}

function getWeekStart(date) {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b);
}

let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 1800);
}